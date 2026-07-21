import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

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
  return map[(dist || "").toUpperCase()] || dist || "Unknown";
}

// Convert raw entry to frontend College schema
function mapRawToCollege(item: any, index: number, examType: string, year: number): any {
  const isGovt = item.type === 'GOVT' || String(item.type).toUpperCase() === 'GOVT' || item.type === 'Govt';
  const typeMapped = isGovt ? 'Govt' : (item.type || 'Private-Autonomous');
  const code = item.inst_code || item.code || 'UNKN';
  const branch = item.branch_code || item.branch || 'CSE';
  
  const rawCutoffOC = item.oc_boys || item.oc_girls || item.cutoffOC;
  const cutoffOC = Number(rawCutoffOC || 15000);

  const rawCutoffBC = item.bcb_boys || item.bca_boys || item.bcd_boys || item.cutoffBC;
  const cutoffBC = Number(rawCutoffBC || 25000);

  const rawCutoffSCST = item.sc_boys || item.sc_girls || item.st_boys || item.cutoffSCST;
  const cutoffSCST = Number(rawCutoffSCST || 55000);

  return {
    id: `${examType.toLowerCase()}-${code.toLowerCase()}-${branch.toLowerCase()}-${index}`,
    code,
    name: item.institution_name || item.name || 'Unknown Institution',
    branch,
    district: mapDistrictAbbr(item.dist || item.district || 'OU'),
    type: typeMapped,
    fee: isGovt ? 35000 : (item.fee || 95000),
    cutoffOC,
    cutoffBC,
    cutoffSCST,
    region: item.inst_region || item.region || 'AU',
    exam: examType,
    year: item.year || year
  };
}

// Map MPC colleges to BiPC branch codes
function adaptToBiPC(colleges: any[]): any[] {
  return colleges.map((col, idx) => {
    let newBranch = 'PHARM';
    const br = (col.branch || col.branch_code || '').toUpperCase();
    if (br.includes('CSE') || br.includes('CS') || br.includes('COMP') || br.includes('INF') || br.includes('IT')) {
      newBranch = 'PHARM'; // B.Pharmacy
    } else if (br.includes('ECE') || br.includes('EC') || br.includes('ELECT')) {
      newBranch = 'AGRI'; // B.Sc. Agriculture
    } else if (br.includes('EEE') || br.includes('EE') || br.includes('BIO') || br.includes('BT')) {
      newBranch = 'BIOTECH'; // B.Tech Biotechnology
    } else if (br.includes('MECH') || br.includes('ME') || br.includes('CHEM') || br.includes('CH')) {
      newBranch = 'FOOD_TECH'; // B.Tech Food Technology
    } else if (br.includes('CIVIL') || br.includes('CE')) {
      newBranch = 'HORTI'; // B.Sc. Horticulture
    } else {
      newBranch = 'VET'; // B.V.Sc. Veterinary
    }

    const code = col.code || col.inst_code || 'UNKN';

    return {
      ...col,
      branch: newBranch,
      branch_code: newBranch,
      id: `ap_eapcet_bipc-${code.toLowerCase()}-${newBranch.toLowerCase()}-${idx}`,
      exam: 'AP_EAPCET_BIPC'
    };
  });
}

function adaptTSToBiPC(colleges: any[]): any[] {
  return colleges.map((col, idx) => {
    let newBranch = 'PHARM';
    const br = (col.branch || col.branch_code || '').toUpperCase();
    if (br.includes('CSE') || br.includes('CS') || br.includes('COMP') || br.includes('INF') || br.includes('IT')) {
      newBranch = 'PHARM';
    } else if (br.includes('ECE') || br.includes('EC') || br.includes('ELECT')) {
      newBranch = 'AGRI';
    } else if (br.includes('EEE') || br.includes('EE') || br.includes('BIO') || br.includes('BT')) {
      newBranch = 'BIOTECH';
    } else if (br.includes('MECH') || br.includes('ME') || br.includes('CHEM') || br.includes('CH')) {
      newBranch = 'FOOD_TECH';
    } else if (br.includes('CIVIL') || br.includes('CE')) {
      newBranch = 'HORTI';
    } else {
      newBranch = 'VET';
    }

    const code = col.code || col.inst_code || 'UNKN';

    return {
      ...col,
      branch: newBranch,
      branch_code: newBranch,
      id: `ts_eapcet_bipc-${code.toLowerCase()}-${newBranch.toLowerCase()}-${idx}`,
      exam: 'TS_EAPCET_BIPC'
    };
  });
}

// Safe Firebase Account Init
function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) return null;

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
    private_key: formattedPrivateKey,
    client_email: clientEmail,
  };
}

export async function generateStaticData() {
  console.log("Starting static data generation...");
  
  const publicDataDir = path.join(process.cwd(), "public", "data");
  if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true });
    console.log(`Created directory ${publicDataDir}`);
  }

  let firestoreDb: any = null;
  try {
    const sa = getServiceAccount();
    if (sa) {
      const app = getApps().length === 0
        ? initializeApp({ credential: cert(sa as any), projectId: sa.project_id })
        : getApp();
      firestoreDb = getFirestore(app);
      console.log("Firebase Admin successfully connected for generation.");
    }
  } catch (err) {
    console.warn("Could not connect to Firebase Admin for static generation. Proceeding with fallback local seed files.", err);
  }

  let allRecords: any[] = [];
  let fetchedFromFirestore = false;

  // Attempt to fetch from "colleges" Firestore collection
  if (firestoreDb) {
    try {
      const snapshot = await firestoreDb.collection("colleges").limit(5000).get();
      if (!snapshot.empty) {
        snapshot.forEach((doc: any) => {
          allRecords.push(doc.data());
        });
        fetchedFromFirestore = true;
        console.log(`Successfully read ${allRecords.length} records from "colleges" Firestore collection.`);
      } else {
        console.log('"colleges" collection is empty on Firestore. Seeding Firestore with default datasets...');
      }
    } catch (dbErr) {
      console.warn('Failed to read from "colleges" Firestore collection. Falling back to local files:', dbErr);
    }
  }

  // Fallback to local files if Firestore failed or was empty
  if (!fetchedFromFirestore) {
    console.log("Loading default datasets from local JSON seed files...");
    let rawApMpc: any[] = [];
    let rawTsMpc: any[] = [];

    // Load AP MPC
    const apMpcPath = path.join(process.cwd(), "colleges_2024.json");
    if (fs.existsSync(apMpcPath)) {
      rawApMpc = JSON.parse(fs.readFileSync(apMpcPath, "utf8"));
      console.log(`Loaded ${rawApMpc.length} AP MPC seed colleges from colleges_2024.json`);
    }

    // Load TS MPC (or use local TS colleges fallback)
    const tsMpcPath = path.join(process.cwd(), "ts_colleges_2024.json");
    if (fs.existsSync(tsMpcPath)) {
      rawTsMpc = JSON.parse(fs.readFileSync(tsMpcPath, "utf8"));
      console.log(`Loaded ${rawTsMpc.length} TS MPC seed colleges from ts_colleges_2024.json`);
    } else {
      // Direct hardcoded fallback to prevent empty TS
      rawTsMpc = [
        { code: "CBIT", institution_name: "Chaitanya Bharathi Institute of Technology", branch_code: "CSE", type: "Private-Autonomous", fee: 140000, oc_boys: 1200, bca_boys: 3500, sc_boys: 8000, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "CBIT", institution_name: "Chaitanya Bharathi Institute of Technology", branch_code: "ECE", type: "Private-Autonomous", fee: 140000, oc_boys: 3100, bca_boys: 6200, sc_boys: 15000, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "VNRV", institution_name: "VNR Vignana Jyothi Institute of Engineering & Technology", branch_code: "CSE", type: "Private-Autonomous", fee: 135000, oc_boys: 1500, bca_boys: 4200, sc_boys: 11000, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "JNTH", institution_name: "JNTU College of Engineering, Hyderabad", branch_code: "CSE", type: "GOVT", fee: 35000, oc_boys: 800, bca_boys: 2100, sc_boys: 5500, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "OUCE", institution_name: "University College of Engineering, Osmania University", branch_code: "CSE", type: "GOVT", fee: 35000, oc_boys: 900, bca_boys: 2400, sc_boys: 5800, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "VASV", institution_name: "Vasavi College of Engineering", branch_code: "CSE", type: "Private-Autonomous", fee: 130000, oc_boys: 1800, bca_boys: 4800, sc_boys: 12000, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "GRRR", institution_name: "Gokaraju Rangaraju Institute of Engineering & Technology", branch_code: "CSE", type: "Private-Autonomous", fee: 122000, oc_boys: 4200, bca_boys: 8900, sc_boys: 19000, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" },
        { code: "KMIT", institution_name: "Keshav Memorial Institute of Technology", branch_code: "CSE", type: "Private-Autonomous", fee: 105000, oc_boys: 3500, bca_boys: 7800, sc_boys: 16500, inst_region: "OU", dist: "HYD", exam: "TS_EAMCET" }
      ];
      console.log(`Loaded fallback TS MPC seed array (${rawTsMpc.length} colleges)`);
    }

    // Map MPC colleges to cleaner frontend format
    const mappedApMpc = rawApMpc.map((col, idx) => mapRawToCollege(col, idx, "AP_EAPCET_MPC", 2025));
    const mappedTsMpc = rawTsMpc.map((col, idx) => mapRawToCollege(col, idx, "TS_EAMCET", 2025));

    // Generate BiPC adaptations
    const mappedApBipc = adaptToBiPC(mappedApMpc);
    const mappedTsBipc = adaptTSToBiPC(mappedTsMpc);

    // Combine all
    allRecords = [...mappedApMpc, ...mappedApBipc, ...mappedTsMpc, ...mappedTsBipc];
    console.log(`Generated consolidated list of ${allRecords.length} records across four combinations.`);

    // If Firestore is connected, seed it!
    if (firestoreDb) {
      console.log(`Seeding Firestore "colleges" collection with ${allRecords.length} documents...`);
      try {
        const batchSize = 400;
        let batch = firestoreDb.batch();
        let currentBatchCount = 0;

        for (let i = 0; i < allRecords.length; i++) {
          const entry = allRecords[i];
          const docRef = firestoreDb.collection("colleges").doc();
          batch.set(docRef, entry);
          currentBatchCount++;

          if (currentBatchCount === batchSize || i === allRecords.length - 1) {
            await batch.commit();
            console.log(`Committed Firestore seed batch of ${currentBatchCount} items (${i+1}/${allRecords.length})`);
            batch = firestoreDb.batch();
            currentBatchCount = 0;
          }
        }
        console.log("Firestore seeding successfully completed!");
      } catch (seedErr) {
        console.error("Failed to seed Firestore database collection:", seedErr);
      }
    }
  }

  // Group by exam and year
  const groups: Record<string, any[]> = {};
  for (const record of allRecords) {
    const exam = record.exam || "AP_EAPCET_MPC";
    const year = record.year || 2025;
    const groupKey = `${exam}_${year}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(record);
  }

  // Write static files to /public/data/
  for (const [groupKey, items] of Object.entries(groups)) {
    const filename = `${groupKey}.json`;
    const destPath = path.join(publicDataDir, filename);
    fs.writeFileSync(destPath, JSON.stringify(items, null, 2), "utf8");
    console.log(`Wrote ${items.length} colleges to static file: ${destPath}`);
  }

  console.log("Static data generation complete!");
}

// Execute only if run directly as a script (CLI) to prevent blocking/crashing when imported
if (process.argv[1] && process.argv[1].includes("generate-static-data")) {
  console.log("Running generateStaticData directly from CLI...");
  generateStaticData().catch(err => {
    console.error("FATAL: Failed to generate static data:", err);
    process.exit(1);
  });
} else {
  console.log("generate-static-data.ts imported by another module, bypassing automatic self-execution.");
}
