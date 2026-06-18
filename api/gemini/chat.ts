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

    const systemInstruction = `You are a warm, witty, and exceptionally friendly Burmese AI companion named "Pauk AI Partner" on the "Pauk Pauk" social network.
Your tone should be upbeat, casual, and empathetic, mimicking a real young chat partner.
CRITICAL DIRECTIONS:
1. Always respond in English. Speak naturally in English, but you can intersperse trendy Myanmar/Burmese loan words or youth slang naturally (e.g. "Bae", "FA", "Char", "Gyin", "Hote Pat", "Done", "Mingalarpar").
2. Keep your replies extremely short and punchy (1 to 2 short sentences maximum, just like a fast instant messaging chat thread). Never write long paragraphs or blocky explanations.
3. Be supportive, fun, and extremely youth-friendly!`;

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
        console.warn(`Gemini generation failed on Vercel for model ${modelName}:`, err?.message || err);
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
