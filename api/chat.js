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

// Collect all available API keys from environment
function getApiKeys() {
  const keys = [];
  // Support GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEY_2, ... GROQ_API_KEY_9
  if (process.env.GROQ_API_KEY)   keys.push(process.env.GROQ_API_KEY);
  for (let i = 1; i <= 9; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

// Call Groq with a specific key
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return res.status(500).json({ error: "No API keys configured." });
  }

  // Build messages array
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  if (Array.isArray(history)) {
    const recent = history.slice(-10);
    for (const turn of recent) {
      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: turn.content
      });
    }
  }
  messages.push({ role: "user", content: message });

  // Try each key in order — rotate on rate limit (429) or quota error (503)
  let lastError = null;

  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const { status, data } = await callGroq(apiKeys[i], messages);

      // Success
      if (status === 200) {
        const reply = data?.choices?.[0]?.message?.content;
        if (!reply) return res.status(500).json({ error: "No response from AI." });
        return res.status(200).json({ reply, keyUsed: i + 1 });
      }

      // Rate limited or quota exceeded — try next key
      if (status === 429 || status === 503) {
        console.warn(`Key ${i + 1} rate limited (${status}), trying next...`);
        lastError = data?.error?.message || `Key ${i + 1} rate limited`;
        continue;
      }

      // Any other error — return immediately (bad key, invalid request, etc.)
      const errMsg = data?.error?.message || "Groq API error";
      return res.status(status).json({ error: errMsg });

    } catch (err) {
      console.error(`Key ${i + 1} threw an error:`, err.message);
      lastError = err.message;
      continue; // Try next key on network errors too
    }
  }

  // All keys exhausted
  return res.status(429).json({
    error: "All API keys have reached their rate limit. Please try again in a moment."
  });
};
