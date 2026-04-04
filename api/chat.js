const SYSTEM_PROMPT = `You are Bou, a professional and informative AI assistant.
You help users with general knowledge, questions, explanations, and everyday tasks.
Keep responses clear, concise, and well-structured. Use markdown formatting where appropriate:
- Use **bold** for key terms
- Use bullet points or numbered lists for steps or multiple items
- Use code blocks with language labels for any code
- Use headings sparingly, only for longer structured responses
Be friendly but professional. If you don't know something, say so honestly.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured." });
  }

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

  try {
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

    if (!response.ok) {
      const errMsg = data?.error?.message || "Groq API error";
      return res.status(response.status).json({ error: errMsg });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(500).json({ error: "No response from AI." });
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message || "Internal server error." });
  }
};
