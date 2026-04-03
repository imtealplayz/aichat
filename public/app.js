// ===== STATE =====
const conversationHistory = [];
let isLoading = false;

// ===== DOM REFS =====
const messagesEl = document.getElementById("messages");
const inputEl    = document.getElementById("userInput");
const sendBtn    = document.getElementById("sendBtn");

// ===== SECTION NAVIGATION =====
function showSection(name) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  const target = document.getElementById("section-" + name);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setActive(el) {
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  if (el) el.classList.add("active");
}

// ===== HAMBURGER MENU =====
function toggleMenu() {
  const btn  = document.getElementById("hamburger");
  const menu = document.getElementById("mobileMenu");
  btn.classList.toggle("open");
  menu.classList.toggle("open");
}

function closeMobileMenu() {
  document.getElementById("hamburger").classList.remove("open");
  document.getElementById("mobileMenu").classList.remove("open");
}

// Close mobile menu on outside click
document.addEventListener("click", (e) => {
  const menu = document.getElementById("mobileMenu");
  const btn  = document.getElementById("hamburger");
  if (menu.classList.contains("open") && !menu.contains(e.target) && !btn.contains(e.target)) {
    closeMobileMenu();
  }
});

// ===== TIME FORMATTER =====
function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ===== RENDER A MESSAGE =====
function addMessage(content, role) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role === "user" ? "user-message" : "bou-message"}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = formatText(content);

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = getTime();

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

// Basic text formatting: newlines → <br>, **bold**, `code`
function formatText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='font-family:var(--mono);background:rgba(59,130,246,0.12);padding:1px 5px;border-radius:4px;font-size:0.87em'>$1</code>")
    .replace(/\n/g, "<br>");
}

// ===== TYPING INDICATOR =====
function showTyping() {
  const wrap = document.createElement("div");
  wrap.className = "message bou-message";
  wrap.id = "typing-indicator";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble typing-bubble";
  bubble.innerHTML = "<span></span><span></span><span></span>";

  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

// ===== SCROLL =====
function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// ===== AUTO-RESIZE TEXTAREA =====
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

// ===== HANDLE ENTER KEY =====
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;

  // Clear input
  inputEl.value = "";
  inputEl.style.height = "auto";

  // Show user message
  addMessage(text, "user");

  // Add to history
  conversationHistory.push({ role: "user", content: text });

  // Lock UI
  isLoading = true;
  sendBtn.disabled = true;
  showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(0, -1)
      })
    });

    const data = await response.json();
    hideTyping();

    if (!response.ok || data.error) {
      addMessage("⚠️ " + (data.error || "Something went wrong. Please try again."), "bou");
    } else {
      addMessage(data.reply, "bou");
      conversationHistory.push({ role: "assistant", content: data.reply });

      // Keep history lean — last 20 messages
      if (conversationHistory.length > 20) conversationHistory.splice(0, 2);
    }
  } catch (err) {
    hideTyping();
    addMessage("⚠️ Could not reach the server. Please try again.", "bou");
  }

  // Unlock UI
  isLoading = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

// ===== INIT =====
window.addEventListener("load", () => {
  inputEl.focus();
});
