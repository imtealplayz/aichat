require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// System prompt for Bou — professional, informative, helpful
const SYSTEM_PROMPT = `You are Bou, a professional and informative AI assistant. 
You help users with general knowledge, questions, explanations, and everyday tasks. 
Keep responses clear, concise, and helpful. Avoid overly long answers unless the topic requires depth.
You are friendly but professional in tone. If you don't know something, say so honestly.`;

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return res.status(500).json({ error: "API key not configured. Please add your Gemini API key to server/.env" });
  }

  // Build conversation history for Gemini
  const contents = [];

  // Add prior history if provided (last 6 messages max for lightweight memory)
  if (Array.isArray(history)) {
    const recent = history.slice(-6);
    for (const turn of recent) {
      contents.push({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }]
      });
    }
  }

  // Add the new user message
  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || "Gemini API error";
      return res.status(response.status).json({ error: errMsg });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      return res.status(500).json({ error: "No response from AI." });
    }

    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Bou server running at http://localhost:${PORT}`);
});
