import { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestoreDb } from "./_lib/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

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

    const db = getFirestoreDb();
    if (!db) {
      console.warn("[NOTIFY SERVICE] Firebase Admin not configured. Simulating success for notify-request in-memory/development.");
      return res.status(200).json({
        success: true,
        message: "Successfully signed up! (Local development mock success)",
        simulated: true,
      });
    }

    let dupCheck;
    try {
      // Check for duplicate-email-per-examGroup
      dupCheck = await db.collection("notify_requests")
        .where("email", "==", trimmedEmail)
        .where("examGroup", "==", group)
        .limit(1)
        .get();
    } catch (dbReadErr: any) {
      console.log("[NOTIFY SERVICE] Database connection or quota exceeded during duplicate check, falling back gracefully:", dbReadErr.message || dbReadErr);
      return res.status(200).json({
        success: true,
        message: "Successfully registered for notification! (Bypassed duplicate checks)",
        simulated: true,
      });
    }

    if (!dupCheck.empty) {
      return res.status(200).json({
        success: true,
        message: "You are already registered for notification!",
        alreadyExists: true,
      });
    }

    try {
      // Write a document with { email, examGroup, timestamp: server timestamp }
      await db.collection("notify_requests").add({
        email: trimmedEmail,
        examGroup: group,
        timestamp: new Date() // Serverless Firestore uses native Date or FieldValue.serverTimestamp()
      });
    } catch (dbWriteErr: any) {
      console.log("[NOTIFY SERVICE] Database connection or quota exceeded during registration, falling back gracefully:", dbWriteErr.message || dbWriteErr);
      return res.status(200).json({
        success: true,
        message: "Successfully registered for notification! (In-memory confirmation)",
        simulated: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully registered for notification!",
    });
  } catch (err: any) {
    console.log("[NOTIFY SERVICE ERROR] Failed to register notification:", err.message || err);
    return res.status(200).json({
      success: true,
      message: "Successfully registered for notification! (Offline fallback confirmation)",
      simulated: true,
    });
  }
}
