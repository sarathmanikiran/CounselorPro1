import admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

export function getServiceAccount() {
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

// Lazy initialization of Firebase Admin
let firestoreDb: any = null;
let firestoreInitialized = false;

export function getFirestoreDb() {
  if (firestoreInitialized) {
    return firestoreDb;
  }

  try {
    const serviceAccount = getServiceAccount();
    if (serviceAccount) {
      const adminModule = admin as any;
      const adminApp = adminModule.apps.length === 0 
        ? adminModule.initializeApp({ credential: adminModule.credential.cert(serviceAccount as any), projectId: serviceAccount.project_id })
        : adminModule.app();
      firestoreDb = adminModule.firestore(adminApp);
      console.log("Firebase Admin successfully initialized on the serverless function.");
    } else {
      console.log("Firebase credentials not fully set up in environment. Firestore features will fall back gracefully.");
    }
  } catch (err) {
    console.log("Failed to initialize Firebase Admin in serverless lib:", err);
  }
  firestoreInitialized = true;
  return firestoreDb;
}

export function mapDistrictAbbr(dist: string): string {
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

export function mapRawToCollege(item: any, index: number, examType: string): any {
  const isGovt = item.type === 'GOVT' || String(item.type).toUpperCase() === 'GOVT';
  const typeMapped = isGovt ? 'Govt' : 'Private-Autonomous';
  const code = item.inst_code || item.code || 'UNKN';
  const branch = item.branch_code || item.branch || 'CSE';
  const actualExam = item.exam || examType;
  
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
    id: `${actualExam.toLowerCase()}-${(item.inst_code || item.code || 'col').toLowerCase()}-${(item.branch_code || item.branch || 'cse').toLowerCase()}-${index}`,
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
    exam: actualExam
  };
}

// Global cache objects that persist inside warm serverless containers
export let cachedCollegesResponse: { colleges: any[]; source: string; count: number } | null = null;
export let firestoreUnavailable = false;

export function setCachedColleges(value: { colleges: any[]; source: string; count: number } | null) {
  cachedCollegesResponse = value;
}

export function setFirestoreUnavailable(value: boolean) {
  firestoreUnavailable = value;
}

// AI Client
let aiClient: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

export function getAIClient(): GoogleGenAI {
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
