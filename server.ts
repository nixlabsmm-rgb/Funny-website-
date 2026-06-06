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
Your tone should be upbeat, casual, and empathetic. Use friendly modern Burmese colloquial language with modern slangs when chatting, representing the youthful energy of Pauk Pauk.
You are extremely knowledgeable about Myanmar/Burmese culture, modern social media slangs, trends and youths' lifestyle.
Whenever the user asks about Burmese slangs from Pauk Pauk, define them, share a short funny sentence, or teach them how to use them with style!
Always try to use standard Burmese script or elegant colloquial speech, interspersed with trendy English/Burmese loan words naturally (e.g. "Bae", "FA", "Char", "Gyin", "Hote Pat", "Done" etc.).
Keep your responses relatively concise but filled with warmth and positive vibes (Burmese-style 'Pyaw Pyaw Shwin Shwin'!).`;

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

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
        },
      });

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
