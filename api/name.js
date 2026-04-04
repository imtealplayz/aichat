function getApiKeys() {
  const keys = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  if (!message) return res.status(400).json({ name: "New Chat" });

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) return res.status(200).json({ name: "New Chat" });

  const prompt = `Generate a short chat title (3-5 words max, no quotes, no punctuation at end) that summarizes this message: "${message.slice(0, 200)}"`;

  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeys[i]}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
          max_tokens: 20
        })
      });

      const data = await response.json();
      if (response.status === 200) {
        const name = data?.choices?.[0]?.message?.content?.trim() || "New Chat";
        // Clean up — remove quotes, limit length
        const clean = name.replace(/['"]/g, "").slice(0, 40);
        return res.status(200).json({ name: clean });
      }
      if (response.status === 429 || response.status === 503) continue;
      break;
    } catch (e) {
      continue;
    }
  }

  // Fallback: derive name from message text
  const fallback = message.slice(0, 35).trim() + (message.length > 35 ? "…" : "");
  return res.status(200).json({ name: fallback });
};
