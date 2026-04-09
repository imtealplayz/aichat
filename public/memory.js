// ═══════════════════════════════════════════════════
// BOU MEMORY SYSTEM
// Stores user preferences, facts, and name in
// localStorage. Injected into every API call as
// extra context so Bou "remembers" the user.
// ═══════════════════════════════════════════════════

const MEMORY_KEY = "bou_memory";

// Default memory structure
function defaultMemory() {
  return {
    userName:    null,        // "Teal"
    preferences: [],          // ["prefers short answers", "likes Python"]
    facts:       [],          // ["works as a developer", "is a student"]
    topics:      [],          // recurring topics user cares about
    tone:        null,        // "formal" | "casual" | null
    lastUpdated: null
  };
}

// ── Load / Save ──────────────────────────────────────
function loadMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return defaultMemory();
    return Object.assign(defaultMemory(), JSON.parse(raw));
  } catch {
    return defaultMemory();
  }
}

function saveMemory(memory) {
  memory.lastUpdated = new Date().toISOString();
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
}

function clearMemory() {
  localStorage.removeItem(MEMORY_KEY);
}

// ── Build the memory string injected into prompts ────
function buildMemoryPrompt() {
  const m = loadMemory();
  const lines = [];

  if (m.userName)
    lines.push(`The user's name is ${m.userName}. Address them by name occasionally.`);

  if (m.tone === "casual")
    lines.push("The user prefers a casual, relaxed tone.");
  else if (m.tone === "formal")
    lines.push("The user prefers a formal, professional tone.");

  if (m.preferences.length > 0)
    lines.push(`User preferences: ${m.preferences.join("; ")}.`);

  if (m.facts.length > 0)
    lines.push(`Known facts about the user: ${m.facts.join("; ")}.`);

  if (m.topics.length > 0)
    lines.push(`Topics this user often asks about: ${m.topics.join(", ")}.`);

  if (lines.length === 0) return "";

  return "\n\nUSER CONTEXT (use this to personalize your responses, but don't mention it explicitly unless relevant):\n" + lines.join("\n");
}

// ── Extract memory from a message pair ──────────────
function updateMemoryFromConversation(userMessage, aiReply) {
  const m = loadMemory();
  const msg = userMessage.toLowerCase().trim();

  // ── Name detection ──────────────────────────────
  const namePatterns = [
    /(?:my name is|i(?:'m| am) called|call me|i go by)\s+([a-z][a-z'-]{1,20})/i,
    /^([a-z][a-z'-]{1,20}) here[.,!]/i,
  ];
  for (const p of namePatterns) {
    const match = userMessage.match(p);
    if (match) {
      const name = match[1];
      // Ignore common false positives
      const ignore = ["not", "just", "only", "still", "also", "here", "now", "back", "going", "trying"];
      if (!ignore.includes(name.toLowerCase())) {
        m.userName = name.charAt(0).toUpperCase() + name.slice(1);
        break;
      }
    }
  }

  // ── Tone preference ─────────────────────────────
  if (/keep it (casual|informal|relaxed|friendly)/i.test(msg)) m.tone = "casual";
  if (/be (formal|professional|serious)/i.test(msg)) m.tone = "formal";
  if (/be (casual|chill|relaxed)/i.test(msg)) m.tone = "casual";

  // ── Preferences ─────────────────────────────────
  const prefPatterns = [
    { rx: /i (?:prefer|like|love|enjoy|use|work with)\s+(.{4,50}?)(?:\.|,|$)/i, positive: true },
    { rx: /i (?:don'?t|do not) (?:like|want|prefer|use)\s+(.{4,50}?)(?:\.|,|$)/i, positive: false },
    { rx: /please (?:always|keep|make it)\s+(.{4,50}?)(?:\.|,|$)/i, positive: true },
  ];
  for (const { rx, positive } of prefPatterns) {
    const match = userMessage.match(rx);
    if (match) {
      const pref = (positive ? "" : "doesn't like ") + match[1].trim().toLowerCase();
      if (pref.length > 3 && pref.length < 60 && !m.preferences.includes(pref)) {
        m.preferences.push(pref);
      }
    }
  }

  // ── Facts about the user ─────────────────────────
  const factPatterns = [
    /i(?:'m| am) (?:a |an )?(.{4,50}?)(?:\.|,|!|$)/i,
    /i work (?:as|in|at)\s+(.{4,50}?)(?:\.|,|!|$)/i,
    /i(?:'m| am) (?:from|based in|living in)\s+(.{4,50}?)(?:\.|,|!|$)/i,
    /i(?:'m| am) (\d{1,3}) years old/i,
    /i(?:'m| am) (?:currently )?studying\s+(.{4,50}?)(?:\.|,|!|$)/i,
  ];
  // Avoid saving trivial or duplicate facts
  const ignoreWords = ["not", "just", "here", "fine", "ok", "okay", "good", "sure", "trying", "going", "back", "glad", "happy", "wondering", "asking"];
  for (const p of factPatterns) {
    const match = userMessage.match(p);
    if (match) {
      const fact = match[0].trim().toLowerCase().replace(/[!?]$/, "");
      if (
        fact.length > 6 &&
        fact.length < 80 &&
        !ignoreWords.some(w => fact.startsWith("i'm " + w) || fact.startsWith("i am " + w)) &&
        !m.facts.includes(fact)
      ) {
        m.facts.push(fact);
      }
    }
  }

  // ── Topic tracking ───────────────────────────────
  const topicKeywords = {
    "Python":        /\bpython\b/i,
    "JavaScript":    /\bjavascript\b|\bjs\b/i,
    "machine learning": /\bmachine learning\b|\bml\b|\bai models\b/i,
    "web development": /\bweb dev\b|\bhtml\b|\bcss\b|\bfrontend\b|\bbackend\b/i,
    "gaming":        /\bgaming\b|\bvideo game\b|\bgames\b/i,
    "design":        /\bdesign\b|\bui\b|\bux\b/i,
    "data science":  /\bdata science\b|\bpandas\b|\bnotebook\b/i,
  };
  for (const [topic, rx] of Object.entries(topicKeywords)) {
    if (rx.test(userMessage) && !m.topics.includes(topic)) {
      m.topics.push(topic);
    }
  }

  // ── Keep arrays lean ─────────────────────────────
  if (m.preferences.length > 10) m.preferences = m.preferences.slice(-8);
  if (m.facts.length > 12)       m.facts       = m.facts.slice(-10);
  if (m.topics.length > 8)       m.topics      = m.topics.slice(-6);

  saveMemory(m);
}

// ── Get a readable summary (used in Info/Settings page) ─
function getMemorySummary() {
  const m = loadMemory();
  const parts = [];
  if (m.userName)             parts.push(`Name: ${m.userName}`);
  if (m.tone)                 parts.push(`Tone: ${m.tone}`);
  if (m.preferences.length)   parts.push(`Preferences: ${m.preferences.join(", ")}`);
  if (m.facts.length)         parts.push(`Facts: ${m.facts.join(", ")}`);
  if (m.topics.length)        parts.push(`Topics: ${m.topics.join(", ")}`);
  if (m.lastUpdated)          parts.push(`Last updated: ${new Date(m.lastUpdated).toLocaleString()}`);
  return parts.length ? parts : ["No memory stored yet."];
}
