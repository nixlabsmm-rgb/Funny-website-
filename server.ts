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
