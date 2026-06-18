import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize GenAI client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY_FOR_LOCAL_DEV",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API route for chatting with Pauk AI Partner
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
         res.status(400).json({ error: "Message is required" });
         return;
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
          console.log(`Trying Gemini chat generation using model: ${modelName}`);
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
          console.warn(`Gemini generation failed for model ${modelName}:`, err?.message || err);
          lastError = err;
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error("All Gemini models are currently experiencing high demand. Please try again soon.");
      }

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini Error:", err);
      res.status(500).json({ error: err.message || "Something went wrong" });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
