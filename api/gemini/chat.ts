import { GoogleGenAI } from "@google/genai";

// Initialize GenAI client lazily or at module level safely
const apiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: apiKey || "MOCK_KEY_FOR_LOCAL_DEV",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export default async function handler(req: any, res: any) {
  // CORS configuration or standard methods
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Gracefully handle missing API key to instruct the user if not configured on Vercel
  if (!apiKey) {
    return res.status(500).json({ 
      error: "Gemini API key is missing. Please set the GEMINI_API_KEY environment variable in your Vercel project settings." 
    });
  }

  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const systemInstruction = `You are "Pauk AI Partner", a warm, normal, and friendly companion.
CRITICAL INSTRUCTIONS:
1. Always respond in English automatically. Do NOT reply in Burmese under any circumstances.
2. Keep your replies extremely short, brief, and punchy (usually 1 short sentence or several words maximum). This is crucial to minimize chat costs.
3. Be helpful, polite, and direct in English. No long paragraphs, list summaries, or forced slang words.`;

    const formattedContents = [];
    
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        formattedContents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    formattedContents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    let response;
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying Gemini chat generation on Vercel using model: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: formattedContents,
          config: {
            systemInstruction,
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("All Gemini models are currently experiencing high demand. Please try again soon.");
    }

    return res.status(200).json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini Vercel Handler Error:", err);
    return res.status(500).json({ error: err?.message || "Something went wrong" });
  }
}
