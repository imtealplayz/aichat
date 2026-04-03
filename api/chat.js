// No require needed — native fetch is built into Node.js 18+

const SYSTEM_PROMPT = `You are Bou, a professional and informative AI assistant. 
You help users with general knowledge, questions, explanations, and everyday tasks. 
Keep responses clear, concise, and helpful. Avoid overly long answers unless the topic requires depth.
You are friendly but professional in tone. If you don't know something, say so honestly.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured." });
  }

  const contents = [];

  if (Array.isArray(history)) {
    const recent = history.slice(-6);
    for (const turn of recent) {
      contents.push({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }]
      });
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
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

    res.status(200).json({ reply });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message || "Internal server error." });
  }
};
