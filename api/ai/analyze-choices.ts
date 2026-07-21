import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAIClient } from "../_lib/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(451).json({ error: "Method not allowed. Use POST." });
  }

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

  const apiKey = process.env.GEMINI_API_KEY;

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
    return res.json({ analysis: analysisText });

  } catch (err: any) {
    console.error("Gemini API Error:", err);
    return res.status(500).json({ error: "Failed to query AI Counselor: " + err.message });
  }
}
