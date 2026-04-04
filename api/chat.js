const SYSTEM_PROMPT = `You are Bou, a concise and professional AI assistant.

RESPONSE RULES — follow these strictly:
- Be direct. Answer the question asked, nothing more.
- Do NOT volunteer code examples unless the user explicitly asks you to write or show code.
- Do NOT pad responses with intros like "Great question!" or outros like "I hope this helps!"
- Keep answers short by default. Use longer responses only when the topic genuinely needs it.
- If asked a yes/no question, lead with yes or no, then a brief explanation if needed.

FORMATTING RULES:
- Use **bold** only for genuinely important terms, not decoration.
- Use bullet points or numbered lists only when listing 3 or more distinct items.
- Use a heading (##) only when the response has clearly separate sections.
- Use code blocks (with language label) only when showing actual code that was requested.
- Never use all three of headings + lists + code unless the response truly needs all of them.

TONE:
- Friendly but efficient. Like a knowledgeable colleague, not a tutorial website.
- If you don't know something, say so briefly and honestly.`;

function getApiKeys() {
  const keys = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

async function callGroq(apiKey, messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });
  const data = await response.json();
  return { status: response.status, data };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history } = req.body;
  if (!message || typeof message !== "string") return res.status(400).json({ error: "Message is required." });

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) return res.status(500).json({ error: "No API keys configured. Add GROQ_API_KEY in Vercel environment variables." });

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  if (Array.isArray(history)) {
    for (const turn of history.slice(-10)) {
      messages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: turn.content });
    }
  }
  messages.push({ role: "user", content: message });

  let lastError = "Unknown error";

  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const { status, data } = await callGroq(apiKeys[i], messages);

      if (status === 200) {
        const reply = data?.choices?.[0]?.message?.content;
        if (!reply) return res.status(500).json({ error: "Empty response from AI." });
        return res.status(200).json({ reply });
      }

      // Rate limited — try next key
      if (status === 429 || status === 503) {
        lastError = data?.error?.message || `Rate limited on key ${i + 1}`;
        console.warn(`[Bou] Key ${i + 1}/${apiKeys.length} rate limited (${status}), trying next...`);
        continue;
      }

      // Auth error or bad request — fail fast
      const errMsg = data?.error?.message || `API error ${status}`;
      console.error(`[Bou] Key ${i + 1} returned ${status}: ${errMsg}`);
      return res.status(status).json({ error: errMsg });

    } catch (err) {
      lastError = err.message;
      console.error(`[Bou] Key ${i + 1} network error: ${err.message}`);
      continue;
    }
  }

  return res.status(429).json({ error: "All API keys are currently rate limited. Please wait a moment and try again." });
};
