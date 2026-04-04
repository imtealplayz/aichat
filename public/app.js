// ===== STATE =====
const conversationHistory = [];
let isLoading = false;

// ===== DOM REFS =====
const messagesEl = document.getElementById("messages");
const inputEl    = document.getElementById("userInput");
const sendBtn    = document.getElementById("sendBtn");
const welcomeEl  = document.getElementById("welcomeState");

// ===== SECTION NAV =====
function showSection(name) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById("section-" + name).classList.add("active");
}
function setActive(el) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
}
function setActiveByName(name) {
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.textContent.trim().toLowerCase() === name);
  });
}

// ===== MOBILE MENU =====
function toggleMobileMenu() {
  const drawer  = document.getElementById("mobileDrawer");
  const overlay = document.getElementById("mobileOverlay");
  const btn     = document.getElementById("hamburger");
  if (drawer.classList.contains("open")) { closeMobileMenu(); return; }
  drawer.classList.add("open");
  overlay.style.display = "block";
  setTimeout(() => overlay.classList.add("open"), 10);
  btn.classList.add("open");
}
function closeMobileMenu() {
  const drawer  = document.getElementById("mobileDrawer");
  const overlay = document.getElementById("mobileOverlay");
  const btn     = document.getElementById("hamburger");
  drawer.classList.remove("open");
  overlay.classList.remove("open");
  btn.classList.remove("open");
  setTimeout(() => { overlay.style.display = "none"; }, 280);
}

// ===== SUGGESTIONS =====
function fillSuggestion(el) {
  inputEl.value = el.textContent;
  autoResize(inputEl);
  updateSendBtn();
  inputEl.focus();
}

// ===== UTILS =====
function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function updateSendBtn() {
  sendBtn.disabled = inputEl.value.trim() === "" || isLoading;
}
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
  updateSendBtn();
}
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
}
function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// ===== DISMISS WELCOME =====
function dismissWelcome() {
  if (welcomeEl && welcomeEl.parentNode) {
    welcomeEl.style.opacity = "0";
    welcomeEl.style.transform = "translateY(-8px)";
    welcomeEl.style.transition = "opacity 0.2s, transform 0.2s";
    setTimeout(() => welcomeEl.remove(), 200);
  }
}

// ===== MARKDOWN RENDERER =====
function renderMarkdown(text) {
  function escHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  const codeBlocks = [];
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || "code", code: escHtml(code.trim()) });
    return `%%CB_${idx}%%`;
  });
  text = escHtml(text);
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>');
  text = text.replace(/^---$/gm, '<hr class="md-hr">');
  text = text.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split("\n").map(l => `<li>${l.replace(/^\d+\. /,"")}</li>`).join("");
    return `<ol class="md-ol">${items}</ol>`;
  });
  text = text.replace(/((?:^[*\-] .+\n?)+)/gm, match => {
    const items = match.trim().split("\n").map(l => `<li>${l.replace(/^[*\-] /,"")}</li>`).join("");
    return `<ul class="md-ul">${items}</ul>`;
  });
  text = text.replace(/\n{2,}/g, "</p><p class='md-p'>");
  text = `<p class="md-p">${text}</p>`;
  text = text.replace(/(?<!>)\n(?!<)/g, "<br>");
  text = text.replace(/%%CB_(\d+)%%/g, (_, i) => {
    const { lang, code } = codeBlocks[i];
    return `<div class="code-block">
      <div class="code-header">
        <span class="code-lang">${lang}</span>
        <button class="copy-btn" onclick="copyCode(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>Copy
        </button>
      </div>
      <pre class="code-pre"><code>${code}</code></pre>
    </div>`;
  });
  return text;
}

// ===== COPY CODE =====
function copyCode(btn) {
  const code = btn.closest(".code-block").querySelector("code").innerText;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`;
      btn.classList.remove("copied");
    }, 2000);
  });
}

// ===== ADD USER MESSAGE =====
function addUserMessage(content) {
  dismissWelcome();
  const row = document.createElement("div");
  row.className = "message-row user-row";

  const avatar = document.createElement("div");
  avatar.className = "user-avatar-sm";
  avatar.textContent = "You";

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "bubble user-bubble";
  bubble.textContent = content;

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = getTime();

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();
}

// ===== THINKING INDICATOR =====
function showThinking() {
  const row = document.createElement("div");
  row.className = "message-row bou-row typing-row";
  row.id = "thinkingRow";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.innerHTML = "<span></span><span></span><span></span>";

  const label = document.createElement("span");
  label.className = "typing-label";
  label.textContent = "Bou is thinking...";

  wrap.appendChild(dots);
  wrap.appendChild(label);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function hideThinking() {
  const el = document.getElementById("thinkingRow");
  if (el) el.remove();
}

// ===== STREAM RESPONSE WORD BY WORD =====
async function streamResponse(fullText) {
  const row = document.createElement("div");
  row.className = "message-row bou-row";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "bubble bou-bubble";

  // Start with just a cursor
  bubble.innerHTML = `<span class="stream-cursor"></span>`;

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = getTime();

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();

  // Split into words and stream them
  const words = fullText.split(" ");
  let streamed = "";
  const delay = ms => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < words.length; i++) {
    streamed += (i === 0 ? "" : " ") + words[i];
    // Show plain text while streaming, cursor at end
    bubble.innerHTML = escapeHtmlSimple(streamed) + `<span class="stream-cursor"></span>`;
    scrollToBottom();
    // Speed: short words faster, longer words slightly slower
    const wordLen = words[i].length;
    const ms = wordLen > 8 ? 38 : wordLen > 4 ? 28 : 18;
    await delay(ms);
  }

  // Done streaming — render full markdown, remove cursor
  bubble.innerHTML = renderMarkdown(fullText);
  scrollToBottom();
}

function escapeHtmlSimple(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;

  inputEl.value = "";
  inputEl.style.height = "auto";
  updateSendBtn();

  addUserMessage(text);
  conversationHistory.push({ role: "user", content: text });

  isLoading = true;
  sendBtn.disabled = true;

  // Show "Bou is thinking..." for ~800ms before responding
  showThinking();
  await new Promise(r => setTimeout(r, 800));

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
    hideThinking();

    if (!response.ok || data.error) {
      // Show error as plain bou message
      const row = document.createElement("div");
      row.className = "message-row bou-row";
      const avatar = document.createElement("div");
      avatar.className = "msg-avatar";
      avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;
      const wrap = document.createElement("div");
      wrap.className = "msg-content";
      const bubble = document.createElement("div");
      bubble.className = "bubble bou-bubble";
      bubble.textContent = "⚠️ " + (data.error || "Something went wrong. Please try again.");
      const time = document.createElement("span");
      time.className = "msg-time";
      time.textContent = getTime();
      wrap.appendChild(bubble);
      wrap.appendChild(time);
      row.appendChild(avatar);
      row.appendChild(wrap);
      messagesEl.appendChild(row);
      scrollToBottom();
    } else {
      await streamResponse(data.reply);
      conversationHistory.push({ role: "assistant", content: data.reply });
      if (conversationHistory.length > 20) conversationHistory.splice(0, 2);
    }
  } catch (err) {
    hideThinking();
    const row = document.createElement("div");
    row.className = "message-row bou-row";
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;
    const wrap = document.createElement("div");
    wrap.className = "msg-content";
    const bubble = document.createElement("div");
    bubble.className = "bubble bou-bubble";
    bubble.textContent = "⚠️ Could not reach the server. Please try again.";
    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = getTime();
    wrap.appendChild(bubble);
    wrap.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesEl.appendChild(row);
    scrollToBottom();
  }

  isLoading = false;
  updateSendBtn();
  inputEl.focus();
}

// ===== INIT =====
window.addEventListener("load", () => {
  inputEl.focus();
  inputEl.addEventListener("input", updateSendBtn);
});
