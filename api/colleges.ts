import { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";
import { 
  getFirestoreDb, 
  firestoreUnavailable, 
  setFirestoreUnavailable 
} from "./_lib/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

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
          console.log(`API served ${colleges.length} colleges from static JSON fallback: ${staticFilename}`);
          return res.json({ colleges, source, count: colleges.length });
        }
      } catch (staticErr: any) {
        console.warn("Failed to serve colleges from static file:", staticErr.message);
      }
    }

    // B. Attempt Firestore Query (Requirement 2 & 6)
    const firestoreDb = getFirestoreDb();
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
          console.log(`API fetched ${colleges.length} entries matching exam=${examParam}, year=${yearParam} from Firestore.`);
          return res.json({ colleges, source, count: colleges.length });
        }
      } catch (firestoreErr: any) {
        setFirestoreUnavailable(true);
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

      // Filter in memory if possible
      colleges = allFallback;
      source = "Local seed file fallback combination";
    }

    return res.json({
      colleges,
      source,
      count: colleges.length
    });
  } catch (err: any) {
    console.log("Colleges retrieval serverless API bypassed gracefully:", err.message);
    return res.json({
      colleges: [],
      source: "Emergency empty fallback",
      count: 0
    });
  }
}
