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

// ===== MARKDOWN RENDERER =====
function renderMarkdown(text) {
  // Escape HTML first
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Extract and protect code blocks before any other processing
  const codeBlocks = [];
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    const language = lang || "code";
    const escaped = escapeHtml(code.trim());
    codeBlocks.push({ language, code: escaped });
    return `%%CODEBLOCK_${index}%%`;
  });

  // Escape remaining HTML
  text = escapeHtml(text);

  // Inline code (single backticks)
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold + italic ***text***
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic *text* (only if not a bullet point)
  text = text.replace(/(?<![*\n])\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // ### Heading 3
  text = text.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');

  // ## Heading 2
  text = text.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // # Heading 1
  text = text.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // Horizontal rule
  text = text.replace(/^---$/gm, '<hr class="md-hr">');

  // Numbered lists — group consecutive items
  text = text.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^\d+\. /, '');
      return `<li>${content}</li>`;
    }).join('');
    return `<ol class="md-ol">${items}</ol>`;
  });

  // Bullet lists — group consecutive items
  text = text.replace(/((?:^[*\-] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^[*\-] /, '');
      return `<li>${content}</li>`;
    }).join('');
    return `<ul class="md-ul">${items}</ul>`;
  });

  // Paragraphs — wrap double newlines
  text = text.replace(/\n{2,}/g, '</p><p class="md-p">');
  text = '<p class="md-p">' + text + '</p>';

  // Single newlines inside paragraphs
  text = text.replace(/(?<!>)\n(?!<)/g, '<br>');

  // Restore code blocks
  text = text.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const { language, code } = codeBlocks[i];
    return `
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">${language}</span>
          <button class="copy-btn" onclick="copyCode(this)" title="Copy code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <pre class="code-pre"><code>${code}</code></pre>
      </div>`;
  });

  return text;
}

// ===== COPY CODE =====
function copyCode(btn) {
  const pre = btn.closest('.code-block').querySelector('code');
  const text = pre.innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!`;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy`;
      btn.classList.remove('copied');
    }, 2000);
  });
}

// ===== RENDER A MESSAGE =====
function addMessage(content, role) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role === "user" ? "user-message" : "bou-message"}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (role === "user") {
    // User messages: plain text, just escape HTML
    bubble.textContent = content;
  } else {
    // Bou messages: full markdown rendering
    bubble.innerHTML = renderMarkdown(content);
  }

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = getTime();

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
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

  inputEl.value = "";
  inputEl.style.height = "auto";

  addMessage(text, "user");
  conversationHistory.push({ role: "user", content: text });

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
      if (conversationHistory.length > 20) conversationHistory.splice(0, 2);
    }
  } catch (err) {
    hideTyping();
    addMessage("⚠️ Could not reach the server. Please try again.", "bou");
  }

  isLoading = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

// ===== INIT =====
window.addEventListener("load", () => {
  inputEl.focus();
});
