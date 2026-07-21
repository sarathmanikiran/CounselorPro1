import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { exec } from "child_process";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import compression from "compression";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(compression());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Helper to construct the Firebase service account from environment variables without logging them
function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const clientId = process.env.FIREBASE_CLIENT_ID;

  if (!projectId || !privateKey || !clientEmail) {
    return null;
  }

  let formattedPrivateKey = privateKey.trim();
  if (formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) {
    formattedPrivateKey = formattedPrivateKey.slice(1, -1);
  } else if (formattedPrivateKey.startsWith("'") && formattedPrivateKey.endsWith("'")) {
    formattedPrivateKey = formattedPrivateKey.slice(1, -1);
  }

  // Check if the input is base64-encoded PEM or JSON
  try {
    const decoded = Buffer.from(formattedPrivateKey, 'base64').toString('utf8');
    if (decoded.includes("-----BEGIN PRIVATE KEY-----") || decoded.includes("-----BEGIN RSA PRIVATE KEY-----")) {
      formattedPrivateKey = decoded;
    } else if (decoded.trim().startsWith("{") && decoded.trim().endsWith("}")) {
      try {
        const parsed = JSON.parse(decoded);
        if (parsed.private_key) {
          formattedPrivateKey = parsed.private_key;
        }
      } catch (e) {}
    }
  } catch (e) {}

  formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

  // If it's a raw base64 string without PEM headers, wrap it:
  if (!formattedPrivateKey.includes("-----BEGIN PRIVATE KEY-----") && !formattedPrivateKey.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    const cleanedBase64 = formattedPrivateKey.replace(/\s+/g, '');
    const chunks = [];
    for (let i = 0; i < cleanedBase64.length; i += 64) {
      chunks.push(cleanedBase64.slice(i, i + 64));
    }
    formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----`;
  } else {
    // If it has headers, but might have formatting issues (like spaces instead of newlines)
    if (!formattedPrivateKey.includes('\n')) {
      const header = "-----BEGIN PRIVATE KEY-----";
      const footer = "-----END PRIVATE KEY-----";
      const headerIndex = formattedPrivateKey.indexOf(header);
      const footerIndex = formattedPrivateKey.indexOf(footer);
      if (headerIndex !== -1 && footerIndex !== -1) {
        const body = formattedPrivateKey.substring(headerIndex + header.length, footerIndex).trim();
        const cleanedBody = body.replace(/\s+/g, '');
        const chunks = [];
        for (let i = 0; i < cleanedBody.length; i += 64) {
          chunks.push(cleanedBody.slice(i, i + 64));
        }
        formattedPrivateKey = `${header}\n${chunks.join('\n')}\n${footer}`;
      }
    }
  }

  // Double check if the resulting private key is too short to be a valid 2048-bit RSA private key
  if (formattedPrivateKey.length < 500) {
    console.warn(`[FIREBASE WARNING] The FIREBASE_PRIVATE_KEY environment variable is truncated (only ${privateKey.length} chars). A full private key should be at least 1500+ characters. Please copy and paste the COMPLETE private key from your service account JSON file, including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- headers. Alternatively, base64-encode your entire private key or service account JSON and paste the single-line base64 string as the secret in AI Studio to prevent newline truncation issues.`);
    return null;
  }

  return {
    type: "service_account",
    project_id: projectId,
    private_key_id: privateKeyId || "",
    private_key: formattedPrivateKey,
    client_email: clientEmail,
    client_id: clientId || "",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
    universe_domain: "googleapis.com"
  };
}

// Initialize Firebase Admin globally
let firestoreDb: any = null;
try {
  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    const adminModule = admin as any;
    const adminApp = adminModule.apps.length === 0 
      ? adminModule.initializeApp({ credential: adminModule.credential.cert(serviceAccount as any), projectId: serviceAccount.project_id })
      : adminModule.app();
    firestoreDb = adminModule.firestore(adminApp);
    console.log("Firebase Admin successfully initialized on the backend.");
  } else {
    console.log("Firebase credentials not fully set up in environment. Firestore features will fall back gracefully.");
  }
} catch (err) {
  console.log("Failed to initialize Firebase Admin globally on server:", err);
}

// District mapping function for colleges
function mapDistrictAbbr(dist: string): string {
  const map: Record<string, string> = {
    'VSKP': 'Visakhapatnam',
    'EG': 'East Godavari',
    'WG': 'West Godavari',
    'ATP': 'Anantapur',
    'CTR': 'Chittoor',
    'KRI': 'Krishna',
    'SKL': 'Srikakulam',
    'GNT': 'Guntur',
    'NLR': 'Nellore',
    'VSP': 'Visakhapatnam',
    'KST': 'Krishna',
    'GTR': 'Guntur',
    'NLR_': 'Nellore'
  };
  return map[dist.toUpperCase()] || dist;
}

// Convert Firestore/JSON raw entry to clean Frontend College schema
function mapRawToCollege(item: any, index: number, examType: string): any {
  const isGovt = item.type === 'GOVT' || String(item.type).toUpperCase() === 'GOVT';
  const typeMapped = isGovt ? 'Govt' : 'Private-Autonomous';
  const code = item.inst_code || item.code || 'UNKN';
  const branch = item.branch_code || item.branch || 'CSE';
  
  // Extract proper cutoffs
  const rawCutoffOC = item.oc_boys || item.oc_girls || item.cutoffOC;
  if (!rawCutoffOC) {
    console.warn(`[DATA WARNING] College ${code} (${branch}) is missing OC cutoff data. Falling back to default: 15000`);
  }
  const cutoffOC = Number(rawCutoffOC || 15000);

  const rawCutoffBC = item.bcb_boys || item.bca_boys || item.bcd_boys || item.cutoffBC;
  if (!rawCutoffBC) {
    console.warn(`[DATA WARNING] College ${code} (${branch}) is missing BC cutoff data. Falling back to default: 25000`);
  }
  const cutoffBC = Number(rawCutoffBC || 25000);

  const rawCutoffSCST = item.sc_boys || item.sc_girls || item.st_boys || item.cutoffSCST;
  if (!rawCutoffSCST) {
    console.warn(`[DATA WARNING] College ${code} (${branch}) is missing SC/ST cutoff data. Falling back to default: 55000`);
  }
  const cutoffSCST = Number(rawCutoffSCST || 55000);

  return {
    id: `${examType.toLowerCase()}-${(item.inst_code || item.code || 'col').toLowerCase()}-${(item.branch_code || item.branch || 'cse').toLowerCase()}-${index}`,
    code: item.inst_code || item.code || 'UNKN',
    name: item.institution_name || item.name || 'Unknown Institution',
    branch: item.branch_code || item.branch || 'CSE',
    district: mapDistrictAbbr(item.dist || item.district || 'OU'),
    type: typeMapped,
    fee: isGovt ? 35000 : (item.fee || 95000),
    cutoffOC,
    cutoffBC,
    cutoffSCST,
    region: item.inst_region || item.region || 'AU',
    exam: examType
  };
}

// Global in-memory cache for colleges list to optimize memory, prevent hitting Firestore quotas, and ensure millisecond response times
let cachedCollegesResponse: { colleges: any[]; source: string; count: number } | null = null;
let firestoreUnavailable = false;

// 1.1 API: Retrieve colleges list from Firestore with file fallback
app.get("/api/colleges", async (req, res) => {
  const examParam = req.query.exam as string; // e.g. "AP_EAPCET_MPC"
  const yearParam = req.query.year ? Number(req.query.year) : 2025; // e.g. 2025

  try {
    let colleges: any[] = [];
    let source = "Memory fallback";

    // A. First try to load from the static JSON file directly (very fast local fallback)
    if (examParam) {
      try {
        const staticFilename = `${examParam}_${yearParam}.json`;
        const staticPath = path.join(process.cwd(), "public", "data", staticFilename);
        if (fs.existsSync(staticPath)) {
          const fileContent = fs.readFileSync(staticPath, "utf8");
          colleges = JSON.parse(fileContent);
          source = `Local Static JSON Fallback (${staticFilename})`;
          console.log(`Express API served ${colleges.length} colleges from static JSON fallback: ${staticFilename}`);
          return res.json({ colleges, source, count: colleges.length });
        }
      } catch (staticErr: any) {
        console.warn("Failed to serve colleges from static file:", staticErr.message);
      }
    }

    // B. Attempt Firestore Query (Requirement 2 & 6)
    if (firestoreDb && !firestoreUnavailable) {
      try {
        let query = firestoreDb.collection("colleges");
        if (examParam) {
          query = query.where("exam", "==", examParam);
        }
        if (yearParam) {
          query = query.where("year", "==", yearParam);
        }
        
        const snapshot = await query.limit(3000).get();
        if (!snapshot.empty) {
          snapshot.forEach((doc: any) => {
            colleges.push(doc.data());
          });
          source = `Firebase Firestore ("colleges" collection)`;
          console.log(`Express API fetched ${colleges.length} entries matching exam=${examParam}, year=${yearParam} from Firestore.`);
          return res.json({ colleges, source, count: colleges.length });
        }
      } catch (firestoreErr: any) {
        firestoreUnavailable = true;
        console.log("Firestore temporarily offline, falling back to all-colleges files.", firestoreErr.message);
      }
    }

    // C. Ultimate fallback: if everything else failed, try to combine local seed files
    if (colleges.length === 0) {
      const apMpcPath = path.join(process.cwd(), "colleges_2024.json");
      const tsMpcPath = path.join(process.cwd(), "ts_colleges_2024.json");
      
      let allFallback: any[] = [];
      if (fs.existsSync(apMpcPath)) {
        allFallback = [...allFallback, ...JSON.parse(fs.readFileSync(apMpcPath, "utf8"))];
      }
      if (fs.existsSync(tsMpcPath)) {
        allFallback = [...allFallback, ...JSON.parse(fs.readFileSync(tsMpcPath, "utf8"))];
      }

      colleges = allFallback.map((col, idx) => mapRawToCollege(col, idx, examParam || "AP_EAPCET_MPC"));
      source = "Local seed file fallback combination";
    }

    return res.json({
      colleges,
      source,
      count: colleges.length
    });
  } catch (err: any) {
    console.log("Colleges retrieval API bypassed gracefully:", err.message);
    return res.json({
      colleges: [],
      source: "Emergency empty fallback",
      count: 0
    });
  }
});

// Initialize GoogleGenAI SDK on the server side
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  if (process.env.NODE_ENV === "production") {
    console.error("==========================================================================");
    console.error("⚠️  CRITICAL PRODUCTION WARNING: GEMINI_API_KEY environment variable is MISSING!");
    console.error("   AI Counselor features WILL NOT function in production without a valid API key.");
    console.error("   Please configure GEMINI_API_KEY in your deployment environment secrets.");
    console.error("==========================================================================");
  } else {
    console.warn("==========================================================================");
    console.warn("⚠️  DEVELOPMENT WARNING: GEMINI_API_KEY environment variable is not defined.");
    console.warn("   AI counselor features will run in local simulation fallback mode.");
    console.warn("==========================================================================");
  }
}
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FALLBACK",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. API: Analyze Web Options using Gemini
app.post("/api/ai/analyze-choices", async (req, res) => {
  const { profile, options, customPrompt } = req.body;

  if (!profile || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: "Invalid profile or options provided." });
  }

  const optionsStr = options
    .map((opt: any) => `#${opt.priority}: College ${opt.collegeCode} - ${opt.collegeName} [Branch: ${opt.branch}]`)
    .join("\n");

  const prompt = customPrompt || `
  You are an expert EAPCET/EAMCET admissions counselor in South India.
  Analyze the student's web options choices, and give professional, strategic, and supportive feedback.
  
  Student Details:
  - Exam: ${profile.exam}
  - Stream: ${profile.stream || 'MPC'}
  - Rank: ${profile.rank}
  - Category: ${profile.category}
  - Region: ${profile.region}
  - Gender: ${profile.gender}
  
  Selected Web Options (In Priority Order 1 to ${options.length}):
  ${optionsStr}
  
  Please provide your analysis in the following structured format (use clear headings, bullet points, and markdown):
  
  1. **Overall Evaluation**: Is the priority order logical? (For example, higher-quality/highly-coveted colleges like CBIT/JNTU/OUCE should generally be above private tier-3 colleges, and CSE should align with their rank).
  2. **Probability of Success**: Based on their rank of ${profile.rank}, which choices are "Targets" (reasonable chance), which are "Reaches" (high-ambition, lower chance), and which are "Safeties" (highly likely backup seats)? Explain the seat probability.
  3. **Ordering Logic Critique**: Are there any issues? E.g. did they place a low-cutoff safety college ABOVE a high-cutoff dream college? (Explain why this is a mistake, as they will get allotted the safety college first and never reach the dream college).
  4. **Strategic Recommendation**: What should they do next? Should they add more safety options, move any options up/down, or choose other branches? Give positive, encouraging, and clear guidance.
  
  Keep the tone professional, friendly, objective, and deeply encouraging. Avoid dry developer jargon. Focus purely on realistic counseling.
  `;

  try {
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        console.error("Blocked AI analysis request in production because GEMINI_API_KEY is not defined.");
        return res.status(500).json({ error: "AI analysis is temporarily unavailable. GEMINI_API_KEY environment variable is missing on this production server." });
      }

      if (customPrompt) {
        // Return a dynamic simulated response for questions
        const mockChatReply = `### AI Counselor Assistant (Simulator Mode)

*Note: running in local simulator mode. Provide a valid GEMINI_API_KEY to activate full real-time AI responses.*

That is an excellent question regarding your web options! Under the **${profile.stream || 'MPC'}** stream, your rank of **${profile.rank}** in **${profile.exam}** (under category **${profile.category}**) makes your current list of choices highly relevant. 

Specifically:
1. **Stream Fit**: Your selections align perfectly with your ${profile.stream || 'MPC'} choice.
2. **Priority Sequence**: Your current arrangement is strategically sequenced to target the highest-quality colleges first while retaining solid safeties.
3. **Refinement Suggestion**: We recommend keeping your options open and considering related specialized tracks (like Biotech/Pharm for BiPC or AIML/Data-Science for MPC) to maximize your chances!`;
        return res.json({ analysis: mockChatReply });
      }

      // Return a realistic mock response if API Key is not set, ensuring a smooth offline preview experience
      const mockReply = `### AI Counselor Analysis (Simulator Mode)

*Note: running in local simulator mode. Provide a valid GEMINI_API_KEY in the Secrets panel to activate full real-time AI analytics.*

#### 1. Overall Evaluation
Your list of **${options.length} web options** is highly structured! You have focused heavily on **${profile.exam}** engineering options under the **${profile.stream || 'MPC'}** stream. Your ranking of **${profile.rank}** puts you in a highly strategic position.

#### 2. Probability of Success
- **Reaches**: Your top choices are excellent high-ambition seats. With rank **${profile.rank}**, getting into top branches at premier institutes (like JNTU or CBIT) under the **${profile.category}** category will be highly competitive but absolutely worth attempting as top-tier preferences.
- **Targets**: Choices ranked 3 to 5 are your strongest strategic bets. Your rank aligns perfectly with the historical cutoff bands for these institutions.
- **Safeties**: Your lower choices are highly secure backups. These autonomous/private institutions historically accept ranks well beyond yours, guaranteeing you will not end up without an allotment.

#### 3. Ordering Logic Critique
Your sequence is generally **well-designed**. You have correctly followed the golden rule of counseling: **Place your absolute dream choices at the very top, followed by target colleges, and finally safeties at the bottom.** There are no invalid lower-cutoff colleges blocking your high-cutoff aspirations.

#### 4. Strategic Recommendation
- **Don't freeze too early**: Keep this simulation list saved!
- **Add 2 more options**: If you want absolute peace of mind, we recommend adding at least two more options in related branches (e.g., CSE-AIML or CSE-DS for MPC, or related Pharma/Biotech fields for BiPC) to maximize your chances.
- **You are ready**: You are doing an outstanding job practicing on the simulator. This practice prevents costly mistakes on the real day!`;
      return res.json({ analysis: mockReply });
    }

    const client = getAIClient();
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const analysisText = response.text || "No response received from counselor AI.";
    res.json({ analysis: analysisText });

  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: "Failed to query AI Counselor: " + err.message });
  }
});

// API: Expose public non-sensitive Firebase config for client-side SDK initialization
app.get("/api/config/firebase", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com` : ""),
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || ""
  });
});

// 1.4. API: Handle coming soon notification requests
app.post("/api/notify-request", async (req, res) => {
  try {
    const { email, examGroup } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required and must be a string." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const group = examGroup || "TS_EAPCET_BIPC";

    if (!firestoreDb) {
      console.warn("[NOTIFY SERVICE] Firebase Admin not configured. Simulating success for notify-request in local development.");
      return res.status(200).json({
        success: true,
        message: "Successfully signed up! (Local development mock success)",
        simulated: true,
      });
    }

    // Check for duplicate-email-per-examGroup
    const dupCheck = await firestoreDb.collection("notify_requests")
      .where("email", "==", trimmedEmail)
      .where("examGroup", "==", group)
      .limit(1)
      .get();

    if (!dupCheck.empty) {
      return res.status(200).json({
        success: true,
        message: "You are already registered for notification!",
        alreadyExists: true,
      });
    }

    // Write a document with { email, examGroup, timestamp: server timestamp }
    await firestoreDb.collection("notify_requests").add({
      email: trimmedEmail,
      examGroup: group,
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Successfully registered for notification!",
    });
  } catch (err: any) {
    console.error("[NOTIFY SERVICE ERROR] Failed to register notification in local server:", err);
    return res.status(500).json({ error: "Server error occurred: " + err.message });
  }
});

// 1.5. API: Handle database administrative uploads from the client
app.post("/api/admin/upload-colleges", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"] || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access Denied: Missing or malformed Authorization header." });
    }

    const idToken = authHeader.substring(7);

    if (!firestoreDb) {
      return res.status(500).json({ error: "Server Error: Firebase environment variables are not configured on this server." });
    }

    // Verify the Firebase ID Token using firebase-admin Auth
    const decodedToken = await (admin as any).auth().verifyIdToken(idToken);
    const email = decodedToken.email || "";

    if (email !== "sarathdasireddy369@gmail.com") {
      return res.status(403).json({ error: `Access Denied: Account '${email}' is not authorized. Only sarathdasireddy369@gmail.com can modify the database.` });
    }

    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid data format. Expected a JSON array of college-branch entries." });
    }

    const examParam = (req.query.exam as string) || "";
    const yearParam = req.query.year ? Number(req.query.year) : 2025;
    const chunkIndex = req.query.chunkIndex !== undefined ? Number(req.query.chunkIndex) : 0;
    const isLastChunk = req.query.isLastChunk !== undefined ? req.query.isLastChunk === "true" : true;

    // A. Identify unique exam+year combinations in the uploaded dataset to delete stale records
    const combinations = new Set<string>();
    for (const entry of data) {
      let entryExam = entry.exam || examParam;
      if (entryExam === "AP_EAPCET") {
        const br = (entry.branch || entry.branch_code || "").toUpperCase();
        const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
        entryExam = isBiPCBranch ? "AP_EAPCET_BIPC" : "AP_EAPCET_MPC";
      } else if (entryExam === "TS_EAMCET") {
        const br = (entry.branch || entry.branch_code || "").toUpperCase();
        const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
        entryExam = isBiPCBranch ? "TS_EAPCET_BIPC" : "TS_EAMCET";
      } else if (!entryExam) {
        entryExam = "AP_EAPCET_MPC";
      }
      const entryYear = entry.year ? Number(entry.year) : yearParam;
      combinations.add(`${entryExam}|${entryYear}`);
    }

    // B. Clear existing documents ONLY on the first chunk of the upload series (chunkIndex === 0)
    if (chunkIndex === 0) {
      console.log(`Performing concurrent database clean-up for combinations: ${Array.from(combinations).join(', ')}...`);
      const cleanPromises = Array.from(combinations).map(async (comb) => {
        const [combExam, combYearStr] = comb.split("|");
        const combYear = Number(combYearStr);
        try {
          const existingSnapshot = await firestoreDb.collection("colleges")
            .where("exam", "==", combExam)
            .where("year", "==", combYear)
            .get();
          if (!existingSnapshot.empty) {
            const docs = existingSnapshot.docs;
            const deletePromises = [];
            // Chunk deletions in groups of 400 for safety under Firestore 500 batch limit
            for (let j = 0; j < docs.length; j += 400) {
              const chunk = docs.slice(j, j + 400);
              const deleteBatch = firestoreDb.batch();
              chunk.forEach((doc: any) => {
                deleteBatch.delete(doc.ref);
              });
              deletePromises.push(deleteBatch.commit());
            }
            await Promise.all(deletePromises);
            console.log(`Cleared ${existingSnapshot.size} stale database records in ${deletePromises.length} batches for ${combExam}.`);
          }
        } catch (clearErr: any) {
          console.warn(`Non-blocking error during collection cleaning for ${combExam}:`, clearErr.message);
        }
      });
      await Promise.all(cleanPromises);
    } else {
      console.log(`Skipping collection cleanup since chunkIndex is ${chunkIndex}.`);
    }

    // C. Upload directly to Firestore "colleges" collection in parallelized batches of 400
    let successCount = 0;
    let failCount = 0;
    const batchSize = 400;
    const writePromises = [];

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const writeBatch = firestoreDb.batch();

        for (const entry of chunk) {
          let entryExam = entry.exam || examParam;
          if (entryExam === "AP_EAPCET") {
            const br = (entry.branch || entry.branch_code || "").toUpperCase();
            const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
            entryExam = isBiPCBranch ? "AP_EAPCET_BIPC" : "AP_EAPCET_MPC";
          } else if (entryExam === "TS_EAMCET") {
            const br = (entry.branch || entry.branch_code || "").toUpperCase();
            const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
            entryExam = isBiPCBranch ? "TS_EAPCET_BIPC" : "TS_EAMCET";
          } else if (!entryExam) {
            entryExam = "AP_EAPCET_MPC";
          }
          const entryYear = entry.year ? Number(entry.year) : yearParam;

          const preparedEntry = {
            ...entry,
            exam: entryExam,
            year: entryYear
          };

          const docRef = firestoreDb.collection('colleges').doc();
          writeBatch.set(docRef, preparedEntry);
        }

        const p = writeBatch.commit().then(() => {
          successCount += chunk.length;
        }).catch((error: any) => {
          console.error(`Failed to commit write batch:`, error);
          failCount += chunk.length;
        });
        writePromises.push(p);
      }

      await Promise.all(writePromises);
    } catch (writeErr: any) {
      console.error("Firestore batch write error:", writeErr);
      throw writeErr;
    }

    // D. Invalidate dynamic response cache and offline indicators
    cachedCollegesResponse = null;
    firestoreUnavailable = false;

    // E. Static JSON regeneration message
    let staticRegenMsg = "";
    if (isLastChunk) {
      staticRegenMsg = "Data uploaded to Firestore successfully. To publish these changes to the live site, push any commit (or use Vercel's 'Redeploy' button) to trigger a new build — the build step regenerates the static JSON files from Firestore automatically.";
    } else {
      staticRegenMsg = `Chunk ${chunkIndex + 1} uploaded successfully.`;
    }

    return res.json({ 
      message: "Successfully uploaded to Firebase", 
      details: `Successfully uploaded: ${successCount} documents to "colleges" Firestore collection. Failed to upload: ${failCount} documents. ${staticRegenMsg}`, 
      count: data.length 
    });

  } catch (authErr: any) {
    console.error("Authentication or authorization failed:", authErr.message);
    return res.status(401).json({ error: "Authorization Failed: Invalid or expired Firebase ID token.", details: authErr.message });
  }
});

// 2. Serve Vite dev server or production static assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
