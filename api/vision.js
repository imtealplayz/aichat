module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { base64, mimeType, fileName, textContent } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Vision API not configured." });

  // Text-based files (txt, md, csv, json, code files) — no vision needed
  if (textContent) {
    return res.status(200).json({
      fileContext: `File: ${fileName || "uploaded file"}\n\nContent:\n${textContent.slice(0, 8000)}`
    });
  }

  // Image or PDF — send to Gemini vision
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: "File data required." });
  }

  const isPDF = mimeType === "application/pdf";
  const describePrompt = isPDF
    ? "Extract and summarize all the text and content from this PDF. Be thorough and accurate."
    : "Describe this image in detail. Include: what's shown, any text visible, colors, layout, and any relevant technical details if it's a screenshot or diagram.";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: describePrompt }
            ]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Vision API error" });
    }

    const description = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!description) return res.status(500).json({ error: "Could not read the file." });

    return res.status(200).json({
      fileContext: `File: ${fileName || "uploaded file"} (${mimeType})\n\nContent analysis:\n${description}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
