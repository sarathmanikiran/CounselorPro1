import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import { getFirestoreDb, setCachedColleges, setFirestoreUnavailable } from "../_lib/index";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const authHeader = req.headers["authorization"] || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access Denied: Missing or malformed Authorization header." });
    }

    const idToken = authHeader.substring(7);

    // Initialize Firebase Admin database and auth
    const db = getFirestoreDb();

    if (!db) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
      if (privateKey && privateKey.trim().length < 500) {
        return res.status(500).json({ 
          error: `Server Error: Firebase environment variables are misconfigured. The private key in your environment (FIREBASE_PRIVATE_KEY) is truncated and invalid (only ${privateKey.trim().length} characters). A valid RSA private key must be at least 1500+ characters. Please copy and paste the FULL private key from your service account JSON file, including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- headers. Alternatively, base64-encode your entire private key or your entire service account JSON file and paste the single-line base64 string into your secrets in AI Studio.` 
        });
      }
      return res.status(500).json({ error: "Server Error: Firebase environment variables are not configured on this server." });
    }

    // Verify the Firebase ID Token using firebase-admin Auth
    const decodedToken = await getAuth().verifyIdToken(idToken);
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
          const existingSnapshot = await db.collection("colleges")
            .where("exam", "==", combExam)
            .where("year", "==", combYear)
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
        const writeBatch = db.batch();

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

          const docRef = db.collection('colleges').doc();
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

    // D. Invalidate dynamic response cache
    setCachedColleges(null);
    setFirestoreUnavailable(false);

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
}
