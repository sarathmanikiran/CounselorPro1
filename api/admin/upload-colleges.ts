import { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseApp, getFirestoreDb, getFirebaseAuth, setCachedColleges, setFirestoreUnavailable } from "../_lib/index";

export const config = { maxDuration: 60 };

// Deep sanitize helper to ensure no undefined, NaN, or Infinity values are passed to Firestore
function sanitizeFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj !== 'object') {
    if (typeof obj === 'number') {
      if (isNaN(obj) || !isFinite(obj)) {
        return null;
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) {
      continue; // Skip undefined keys entirely
    }
    const sanitizedVal = sanitizeFirestoreData(val);
    if (sanitizedVal !== undefined) {
      sanitized[key] = sanitizedVal;
    }
  }
  return sanitized;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Diagnostic log for request
  console.log("[UPLOAD DIAGNOSTIC] Starting chunk upload request...");

  try {
    const authHeader = req.headers["authorization"] || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        stage: "authorization_check",
        error: "Access Denied: Missing or malformed Authorization header." 
      });
    }

    const idToken = authHeader.substring(7);

    // Diagnostic log for environment variables
    console.log("[UPLOAD DIAGNOSTIC] Verifying environment variables...");
    const missingVars = [];
    if (!process.env.FIREBASE_PROJECT_ID) missingVars.push("FIREBASE_PROJECT_ID");
    if (!process.env.FIREBASE_PRIVATE_KEY) missingVars.push("FIREBASE_PRIVATE_KEY");
    if (!process.env.FIREBASE_CLIENT_EMAIL) missingVars.push("FIREBASE_CLIENT_EMAIL");

    if (missingVars.length > 0) {
      console.error("[UPLOAD DIAGNOSTIC ERROR] Missing Firebase environment variables:", missingVars);
      return res.status(500).json({
        success: false,
        stage: "environment_validation",
        error: `Server Error: Missing required Firebase environment variable(s): ${missingVars.join(", ")}`
      });
    }

    // Initialize Firebase Admin database and auth
    const app = getFirebaseApp();
    const db = getFirestoreDb();
    const auth = getFirebaseAuth();

    if (!app || !db || !auth) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
      if (privateKey && privateKey.trim().length < 500) {
        return res.status(500).json({ 
          success: false,
          stage: "firebase_initialization",
          error: `Server Error: Firebase environment variables are misconfigured. The private key in your environment (FIREBASE_PRIVATE_KEY) is truncated and invalid (only ${privateKey.trim().length} characters). A valid RSA private key must be at least 1500+ characters. Please copy and paste the FULL private key from your service account JSON file, including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- headers. Alternatively, base64-encode your entire private key or your entire service account JSON file and paste the single-line base64 string into your secrets in AI Studio.` 
        });
      }
      return res.status(500).json({ 
        success: false,
        stage: "firebase_initialization",
        error: "Server Error: Firebase credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not fully configured or valid on this server." 
      });
    }

    // Verify the Firebase ID Token using firebase-admin Auth
    let decodedToken;
    try {
      console.log("[UPLOAD DIAGNOSTIC] Verifying ID Token...");
      decodedToken = await auth.verifyIdToken(idToken);
      console.log("[UPLOAD DIAGNOSTIC] ID Token verified successfully.");
    } catch (tokenErr: any) {
      console.error("[UPLOAD DIAGNOSTIC ERROR] ID Token verification failed:", tokenErr);
      return res.status(401).json({
        success: false,
        stage: "token_verification",
        error: "Access Denied: ID Token verification failed. " + tokenErr.message,
        details: tokenErr
      });
    }

    const email = decodedToken.email || "";
    if (email !== "sarathdasireddy369@gmail.com") {
      return res.status(403).json({ 
        success: false,
        stage: "authorization_check",
        error: `Access Denied: Account '${email}' is not authorized. Only sarathdasireddy369@gmail.com can modify the database.` 
      });
    }

    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ 
        success: false,
        stage: "payload_validation",
        error: "Invalid data format. Expected a JSON array of college-branch entries." 
      });
    }

    const examParam = (req.query.exam as string) || "";
    const yearParam = req.query.year ? Number(req.query.year) : 2025;
    const chunkIndex = req.query.chunkIndex !== undefined ? Number(req.query.chunkIndex) : 0;
    const isLastChunk = req.query.isLastChunk !== undefined ? req.query.isLastChunk === "true" : true;

    console.log(`[UPLOAD DIAGNOSTIC] Processing chunkIndex: ${chunkIndex}, isLastChunk: ${isLastChunk}, size: ${data.length}`);

    // A. Identify unique exam+year combinations in the uploaded dataset to delete stale records
    const combinations = new Set<string>();
    for (const entry of data) {
      if (!entry || typeof entry !== "object") continue;
      let entryExam = entry.exam || examParam;
      if (entryExam === "AP_EAPCET") {
        const br = String(entry.branch || entry.branch_code || "").toUpperCase();
        const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
        entryExam = isBiPCBranch ? "AP_EAPCET_BIPC" : "AP_EAPCET_MPC";
      } else if (entryExam === "TS_EAMCET") {
        const br = String(entry.branch || entry.branch_code || "").toUpperCase();
        const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
        entryExam = isBiPCBranch ? "TS_EAPCET_BIPC" : "TS_EAMCET";
      } else if (!entryExam) {
        entryExam = "AP_EAPCET_MPC";
      }
      const entryYear = entry.year ? Number(entry.year) : yearParam;
      combinations.add(`${entryExam}|${entryYear}`);
    }

    // B. Clear existing documents ONLY on the first chunk of the upload series (chunkIndex === 0)
    if (chunkIndex === 0 && combinations.size > 0) {
      console.log(`[UPLOAD DIAGNOSTIC] Performing concurrent database clean-up (up to 500 documents) for combinations: ${Array.from(combinations).join(', ')}...`);
      const cleanPromises = Array.from(combinations).map(async (comb) => {
        const [combExam, combYearStr] = comb.split("|");
        const combYear = Number(combYearStr);
        try {
          const existingSnapshot = await db.collection("colleges")
            .where("exam", "==", combExam)
            .where("year", "==", combYear)
            .limit(500)
            .get();
          if (!existingSnapshot.empty) {
            const docs = existingSnapshot.docs;
            const deletePromises = [];
            // Chunk deletions in groups of 400 for safety under Firestore 500 batch limit
            for (let j = 0; j < docs.length; j += 400) {
              const chunk = docs.slice(j, j + 400);
              const deleteBatch = db.batch();
              chunk.forEach((doc: any) => {
                deleteBatch.delete(doc.ref);
              });
              deletePromises.push(deleteBatch.commit());
            }
            await Promise.all(deletePromises);
            console.log(`[UPLOAD DIAGNOSTIC] Cleared ${existingSnapshot.size} stale database records for ${combExam}.`);
          }
        } catch (clearErr: any) {
          console.error(`[UPLOAD DIAGNOSTIC ERROR] Error during collection cleaning for ${combExam}:`, clearErr);
        }
      });
      await Promise.all(cleanPromises);
    } else {
      console.log(`[UPLOAD DIAGNOSTIC] Skipping collection cleanup (chunkIndex: ${chunkIndex}).`);
    }

    // C. Upload directly to Firestore "colleges" collection in parallelized batches of 400
    let successCount = 0;
    let failCount = 0;
    const batchSize = 400;
    const writePromises = [];

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const writeBatch = db.batch();

        for (const entry of chunk) {
          if (!entry || typeof entry !== "object") continue;

          let entryExam = entry.exam || examParam;
          if (entryExam === "AP_EAPCET") {
            const br = String(entry.branch || entry.branch_code || "").toUpperCase();
            const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
            entryExam = isBiPCBranch ? "AP_EAPCET_BIPC" : "AP_EAPCET_MPC";
          } else if (entryExam === "TS_EAMCET") {
            const br = String(entry.branch || entry.branch_code || "").toUpperCase();
            const isBiPCBranch = br.includes("PHARM") || br.includes("AGRI") || br.includes("BIOTECH") || br.includes("FOOD") || br.includes("HORTI") || br.includes("VET");
            entryExam = isBiPCBranch ? "TS_EAPCET_BIPC" : "TS_EAMCET";
          } else if (!entryExam) {
            entryExam = "AP_EAPCET_MPC";
          }
          const entryYear = entry.year ? Number(entry.year) : yearParam;

          const preparedEntry = sanitizeFirestoreData({
            ...entry,
            exam: entryExam,
            year: entryYear
          });

          // Generate highly deterministic and clean document ID to prevent duplicates
          const instCode = String(entry.inst_code || entry.code || "unknown").toUpperCase().replace(/[^A-Z0-9-_]/g, '_');
          const branchCode = String(entry.branch_code || entry.branch || "unknown").toUpperCase().replace(/[^A-Z0-9-_]/g, '_');
          const docId = `${entryExam}_${entryYear}_${instCode}_${branchCode}`.toUpperCase();

          const docRef = db.collection('colleges').doc(docId);
          writeBatch.set(docRef, preparedEntry);
        }

        const p = writeBatch.commit().then(() => {
          successCount += chunk.length;
        }).catch((error: any) => {
          console.error(`[UPLOAD DIAGNOSTIC ERROR] Failed to commit write batch in chunkIndex ${chunkIndex}:`, error);
          failCount += chunk.length;
        });
        writePromises.push(p);
      }

      await Promise.all(writePromises);
      if (failCount > 0) {
        throw new Error(`Failed to commit ${failCount} documents in write batch.`);
      }
    } catch (writeErr: any) {
      console.error("[UPLOAD DIAGNOSTIC ERROR] Firestore batch write error:", writeErr);
      throw writeErr;
    }

    // D. Invalidate dynamic response cache
    setCachedColleges(null);
    setFirestoreUnavailable(false);

    let staticRegenMsg = "";
    if (isLastChunk) {
      staticRegenMsg = "To publish these changes to the live site, please trigger a Vercel redeploy (e.g., click 'Redeploy' on your Vercel Dashboard, or push a commit). This is necessary because Vercel pre-compiles the static JSON files from Firestore for high performance.";
    } else {
      staticRegenMsg = `Chunk ${chunkIndex + 1} uploaded successfully.`;
    }

    console.log(`[UPLOAD DIAGNOSTIC] Chunk ${chunkIndex} uploaded successfully. Total docs written: ${successCount}`);

    return res.json({ 
      success: true,
      message: "Successfully uploaded to Firebase", 
      details: `Successfully uploaded: ${successCount} documents to "colleges" Firestore collection. Failed to upload: ${failCount} documents. ${staticRegenMsg}`, 
      count: data.length 
    });

  } catch (err: any) {
    console.error("[UPLOAD DIAGNOSTIC FATAL ERROR] Request handler exception caught:", err);
    return res.status(500).json({ 
      success: false,
      stage: "handler_try_catch",
      error: "Server Error: Request failed", 
      details: err?.message || String(err)
    });
  }
}
