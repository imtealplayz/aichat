// ===========================
// CONSTANTS
// ===========================
const MAX_CHATS = 5;
const STORAGE_KEY = "bou_chats";
const ACTIVE_KEY  = "bou_active_chat";

// ===========================
// STATE
// ===========================
let chats        = [];   // [{ id, name, messages: [{role,content}] }]
let activeChatId = null;
let isLoading    = false;
let stopRequested = false;
let currentController = null; // AbortController for fetch

// ===========================
// DOM REFS
// ===========================
const messagesEl  = document.getElementById("messages");
const inputEl     = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const stopBtn     = document.getElementById("stopBtn");

// ===========================
// PAGE NAVIGATION
// ===========================
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");
  // Update topbar title
  const titles = { chat: "Bou", about: "About", info: "Info" };
  const titleEl = document.getElementById("topbarTitle");
  if (titleEl) titleEl.textContent = titles[name] || "Bou";
  // Update active nav items by data-page attribute
  document.querySelectorAll(".nav-item[data-page]").forEach(n => {
    n.classList.toggle("active", n.dataset.page === name);
  });
}

// Single entry point for navigation — used by all nav links
function navigate(name) {
  showPage(name);
  closeMobileMenu();
}

function setActive(el) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) el.classList.add("active");
}

function clearPageActive() {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
}

// ===========================
// MOBILE MENU
// ===========================
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
  setTimeout(() => { if (!drawer.classList.contains("open")) overlay.style.display = "none"; }, 300);
}

// ===========================
// LOCALSTORAGE
// ===========================
function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  localStorage.setItem(ACTIVE_KEY, activeChatId || "");
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    chats = raw ? JSON.parse(raw) : [];
  } catch { chats = []; }
  activeChatId = localStorage.getItem(ACTIVE_KEY) || null;
}

// ===========================
// CHAT MANAGEMENT
// ===========================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function newChat() {
  // If current chat is empty (no messages), just focus input
  const current = chats.find(c => c.id === activeChatId);
  if (current && current.messages.length === 0) {
    showPage("chat"); clearPageActive();
    inputEl.focus();
    return;
  }

  const chat = { id: generateId(), name: "New Chat", messages: [] };

  // Prepend new chat
  chats.unshift(chat);

  // Trim to max 5
  if (chats.length > MAX_CHATS) {
    chats = chats.slice(0, MAX_CHATS);
  }

  activeChatId = chat.id;
  saveChats();
  renderChatHistory();
  renderMessages();
  showPage("chat");
  clearPageActive();
  inputEl.focus();
}

function switchChat(id) {
  if (id === activeChatId) return;
  activeChatId = id;
  saveChats();
  renderChatHistory();
  renderMessages();
  showPage("chat");
  clearPageActive();
  closeMobileMenu();
}

function deleteChat(id, e) {
  e.stopPropagation();
  chats = chats.filter(c => c.id !== id);

  if (activeChatId === id) {
    activeChatId = chats.length > 0 ? chats[0].id : null;
    if (!activeChatId) {
      // No chats left — create a fresh one
      const fresh = { id: generateId(), name: "New Chat", messages: [] };
      chats.unshift(fresh);
      activeChatId = fresh.id;
    }
    renderMessages();
  }

  saveChats();
  renderChatHistory();
}

function getActiveChat() {
  return chats.find(c => c.id === activeChatId) || null;
}

// Ask AI to name the chat
async function nameChat(chatId, firstMessage) {
  try {
    const res = await fetch("/api/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: firstMessage })
    });
    const data = await res.json();
    const chat = chats.find(c => c.id === chatId);
    if (chat && data.name) {
      chat.name = data.name;
      saveChats();
      renderChatHistory();
    }
  } catch (e) { /* silent fail — keep "New Chat" */ }
}

// ===========================
// RENDER CHAT HISTORY SIDEBAR
// ===========================
function renderChatHistory() {
  const containers = [
    document.getElementById("chatHistory"),
    document.getElementById("chatHistoryMobile")
  ];

  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = "";

    if (chats.length === 0) {
      container.innerHTML = `<div style="padding:8px 10px;font-size:0.78rem;color:var(--text-muted);font-style:italic">No chats yet</div>`;
      return;
    }

    chats.forEach(chat => {
      const item = document.createElement("div");
      item.className = "chat-item" + (chat.id === activeChatId ? " active" : "");
      item.onclick = () => switchChat(chat.id);

      item.innerHTML = `
        <svg class="chat-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="chat-item-name">${escHtml(chat.name)}</span>
        <button class="chat-item-del" onclick="deleteChat('${chat.id}', event)" title="Delete chat">✕</button>
      `;
      container.appendChild(item);
    });
  });
}

// ===========================
// RENDER MESSAGES
// ===========================
function renderMessages() {
  const chat = getActiveChat();
  messagesEl.innerHTML = "";

  if (!chat || chat.messages.length === 0) {
    // Show welcome state
    const welcome = document.createElement("div");
    welcome.className = "welcome-state";
    welcome.id = "welcomeState";
    welcome.innerHTML = `
      <div class="welcome-avatar"><img src="/images/bou-avatar.png" alt="Bou" /></div>
      <h2>How can I help you today?</h2>
      <p>Ask me anything — questions, explanations, code, and more.</p>
      <div class="suggestions">
        <button class="suggestion-chip" onclick="fillSuggestion(this)">Explain how machine learning works</button>
        <button class="suggestion-chip" onclick="fillSuggestion(this)">Write a Python hello world</button>
        <button class="suggestion-chip" onclick="fillSuggestion(this)">Difference between RAM and ROM?</button>
        <button class="suggestion-chip" onclick="fillSuggestion(this)">5 tips for better sleep</button>
      </div>
    `;
    messagesEl.appendChild(welcome);
    return;
  }

  chat.messages.forEach(msg => {
    appendMessageRow(msg.role, msg.content, false);
  });
  scrollToBottom();
}

// ===========================
// MESSAGE RENDERING
// ===========================
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}

function appendMessageRow(role, content, animate = true) {
  const row = document.createElement("div");
  row.className = "message-row " + (role === "user" ? "user-row" : "bou-row");
  if (!animate) row.style.animation = "none";

  if (role === "user") {
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
  } else {
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

    const wrap = document.createElement("div");
    wrap.className = "msg-content";

    const bubble = document.createElement("div");
    const isError = content.startsWith("⚠️") || content.startsWith("🕐");
    bubble.className = "bubble bou-bubble" + (isError ? " error-bubble" : "");
    bubble.innerHTML = isError ? escHtml(content) : renderMarkdown(content);

    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = getTime();

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(wrap);
  }

  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

// ===========================
// THINKING INDICATOR
// ===========================
function showThinking() {
  const row = document.createElement("div");
  row.className = "message-row bou-row typing-row";
  row.id = "thinkingRow";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content typing-wrap";

  const dots = document.createElement("div");
  dots.className = "typing-bubble";
  dots.innerHTML = "<span></span><span></span><span></span>";

  const label = document.createElement("span");
  label.className = "typing-label";
  label.textContent = "Bou is thinking…";

  wrap.appendChild(dots);
  wrap.appendChild(label);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function hideThinking() {
  document.getElementById("thinkingRow")?.remove();
}

// ===========================
// STREAMING
// ===========================
async function streamResponse(fullText, chatId) {
  const row = document.createElement("div");
  row.className = "message-row bou-row";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "bubble bou-bubble";
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

  const words = fullText.split(" ");
  let streamed = "";
  const delay = ms => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < words.length; i++) {
    if (stopRequested) break;
    streamed += (i === 0 ? "" : " ") + words[i];
    bubble.innerHTML = escHtml(streamed) + `<span class="stream-cursor"></span>`;
    scrollToBottom();
    const len = words[i].length;
    await delay(len > 8 ? 36 : len > 4 ? 24 : 16);
  }

  // Final render
  const finalText = stopRequested ? streamed + " [stopped]" : fullText;
  bubble.innerHTML = renderMarkdown(stopRequested ? streamed : fullText);
  scrollToBottom();

  // Save to chat
  const chat = chats.find(c => c.id === chatId);
  if (chat) {
    chat.messages.push({ role: "assistant", content: finalText });
    saveChats();
  }
}

// ===========================
// STOP
// ===========================
function stopResponse() {
  stopRequested = true;
  if (currentController) currentController.abort();
  hideThinking();
  setLoadingState(false);
}

// ===========================
// SEND
// ===========================
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;

  // Ensure there's an active chat
  if (!activeChatId) newChat();
  // Dismiss welcome
  document.getElementById("welcomeState")?.remove();

  inputEl.value = "";
  inputEl.style.height = "auto";

  const chat = getActiveChat();
  if (!chat) return;

  const isFirstMessage = chat.messages.length === 0;

  // Save user message
  chat.messages.push({ role: "user", content: text });
  saveChats();

  // Render user message
  appendMessageRow("user", text, true);

  // Name the chat after first message (async, don't await)
  if (isFirstMessage) {
    nameChat(chat.id, text);
  }

  const history = chat.messages.slice(0, -1);
  const chatId  = chat.id;

  setLoadingState(true);
  stopRequested = false;
  currentController = new AbortController();

  showThinking();
  // Brief thinking delay
  await new Promise(r => setTimeout(r, 700));

  if (stopRequested) { setLoadingState(false); return; }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history }),
      signal: currentController.signal
    });

    const data = await response.json();
    hideThinking();

    if (!response.ok || data.error) {
      let errMsg;
      if (response.status === 429 || data.rateLimited) {
        errMsg = "🕐 The server is currently busy. Please wait a moment and try again.";
      } else if (response.status === 500) {
        errMsg = "⚠️ Something went wrong on our end. Please try again.";
      } else {
        errMsg = "⚠️ " + (data.error || "Something went wrong. Please try again.");
      }
      appendMessageRow("bou", errMsg, true);
      const c = chats.find(x => x.id === chatId);
      if (c) { c.messages.push({ role: "assistant", content: errMsg }); saveChats(); }
    } else {
      await streamResponse(data.reply, chatId);
    }
  } catch (err) {
    hideThinking();
    if (err.name !== "AbortError") {
      const errMsg = "⚠️ Could not reach the server. Make sure you have a valid API key set in Vercel.";
      appendMessageRow("bou", errMsg, true);
      const c = chats.find(x => x.id === chatId);
      if (c) { c.messages.push({ role: "assistant", content: errMsg }); saveChats(); }
    }
  }

  setLoadingState(false);
  updateSendBtn();
  inputEl.focus();
}

function setLoadingState(loading) {
  isLoading = loading;
  if (loading) {
    sendBtn.style.display = "none";
    stopBtn.style.display  = "flex";
  } else {
    sendBtn.style.display = "flex";
    stopBtn.style.display  = "none";
    stopRequested = false;
    currentController = null;
  }
}

// ===========================
// INPUT HELPERS
// ===========================
function updateSendBtn() {
  sendBtn.disabled = inputEl.value.trim() === "" || isLoading;
}
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 150) + "px";
  updateSendBtn();
}
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
}
function fillSuggestion(el) {
  inputEl.value = el.textContent;
  autoResize(inputEl);
  updateSendBtn();
  inputEl.focus();
}
function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// ===========================
// MARKDOWN
// ===========================
function renderMarkdown(text) {
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
  text = text.replace(/((?:^\d+\. .+\n?)+)/gm, m => {
    const items = m.trim().split("\n").map(l => `<li>${l.replace(/^\d+\. /,"")}</li>`).join("");
    return `<ol class="md-ol">${items}</ol>`;
  });
  text = text.replace(/((?:^[*\-] .+\n?)+)/gm, m => {
    const items = m.trim().split("\n").map(l => `<li>${l.replace(/^[*\-] /,"")}</li>`).join("");
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
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>Copy
        </button>
      </div>
      <pre class="code-pre"><code>${code}</code></pre>
    </div>`;
  });
  return text;
}

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

// ===========================
// INIT
// ===========================
window.addEventListener("load", () => {
  loadChats();

  // If no chats at all, create a fresh one
  if (chats.length === 0) {
    const fresh = { id: generateId(), name: "New Chat", messages: [] };
    chats.push(fresh);
    activeChatId = fresh.id;
    saveChats();
  } else {
    // Make sure activeChatId is valid
    if (!chats.find(c => c.id === activeChatId)) {
      activeChatId = chats[0].id;
    }
  }

  renderChatHistory();
  renderMessages();

  inputEl.addEventListener("input", updateSendBtn);
  inputEl.focus();
});
