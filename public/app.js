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
let pendingFile = null;       // { fileContext, fileName, fileType, previewUrl }

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
  const titles = { chat: "BouAI", about: "About", images: "Images", info: "Info" };
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
    // Check if it's a saved image message [image:URL:prompt]
    if (msg.role === "assistant" && msg.content.startsWith("[image:")) {
      // Format: [image:https://url/path:the prompt text]
      // Find the prompt by looking after the URL (first occurrence of https://...?... ends before the colon before prompt)
      const inner = msg.content.slice(7, msg.content.length - 1); // strip [image: and ]
      // URL ends at the last ":" that is followed by non-slash (i.e. not part of https://)
      const urlMatch = inner.match(/^(https?:\/\/\S+?):([^:].*)$/);
      if (urlMatch) {
        renderImageMessage(urlMatch[1], urlMatch[2]);
      } else {
        // Fallback: use full inner as URL
        renderImageMessage(inner, "Generated image");
      }
      return;
    }
    appendMessageRow(msg.role, msg.content, false, msg.ts || null);
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

function formatSavedTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  } catch { return ""; }
}

function appendMessageRow(role, content, animate = true, savedTs = null) {
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
    time.textContent = savedTs ? formatSavedTime(savedTs) : getTime();

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
    time.textContent = savedTs ? formatSavedTime(savedTs) : getTime();

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
// THINKING / TYPING INDICATOR
// ===========================
let typingInterval = null;

function showThinking(mode = "thinking") {
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

  const baseText = mode === "image" ? "Generating image" : "Bou is typing";
  let dotCount = 1;
  label.textContent = baseText + ".";
  typingInterval = setInterval(() => {
    dotCount = dotCount >= 3 ? 1 : dotCount + 1;
    label.textContent = baseText + ".".repeat(dotCount);
  }, 500);

  wrap.appendChild(dots);
  wrap.appendChild(label);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function hideThinking() {
  if (typingInterval) { clearInterval(typingInterval); typingInterval = null; }
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
    chat.messages.push({ role: "assistant", content: finalText, ts: new Date().toISOString() });
    saveChats();
  }
}

// ===========================
// IMAGE GENERATION
// ===========================
async function generateImage(prompt, chatId) {
  // Show "Generating image..." indicator
  hideThinking();
  showThinking("image");

  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Date.now()}`;

  // Build generating card
  const row = document.createElement("div");
  row.className = "message-row bou-row";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  // Use an actual img element and wait for it to load
  const img = new Image();
  img.src = imageUrl;
  img.alt = prompt;
  img.style.cssText = "width:100%;aspect-ratio:1/1;object-fit:cover;display:block;border-radius:0";

  // Show shimmer while loading
  const shimmerCard = document.createElement("div");
  shimmerCard.className = "img-generating";
  shimmerCard.innerHTML = `
    <div class="img-shimmer">
      <div class="img-shimmer-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <span class="img-shimmer-text">Generating image...</span>
    </div>`;

  wrap.appendChild(shimmerCard);

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = getTime();
  wrap.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();

  // Wait for image to load or fail
  await new Promise(resolve => {
    img.onload  = resolve;
    img.onerror = resolve;
    // Max wait 20s
    setTimeout(resolve, 20000);
  });

  hideThinking();

  // Replace shimmer with real card or error
  if (img.complete && img.naturalWidth > 0) {
    const card = document.createElement("div");
    card.className = "img-card";
    card.appendChild(img);

    const footer = document.createElement("div");
    footer.className = "img-card-footer";

    const promptEl = document.createElement("span");
    promptEl.className = "img-card-prompt";
    promptEl.textContent = prompt;

    const dlBtn = document.createElement("button");
    dlBtn.className = "img-download-btn";
    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download`;
    dlBtn.onclick = () => downloadImage(imageUrl, prompt);

    footer.appendChild(promptEl);
    footer.appendChild(dlBtn);
    card.appendChild(footer);
    shimmerCard.replaceWith(card);

    // Save to chat history as special image message
    const c = chats.find(x => x.id === chatId);
    if (c) {
      c.messages.push({ role: "assistant", content: `[image:${imageUrl}:${prompt}]`, ts: new Date().toISOString() });
      saveChats();
    }
  } else {
    const errEl = document.createElement("div");
    errEl.className = "img-error";
    errEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Could not generate the image. Please try again.`;
    shimmerCard.replaceWith(errEl);
  }
  scrollToBottom();
}

function downloadImage(url, prompt) {
  const a = document.createElement("a");
  a.href = url;
  a.download = prompt.slice(0, 40).replace(/[^a-z0-9]/gi, "_") + ".png";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Render a saved image message from localStorage
function renderImageMessage(imageUrl, prompt) {
  const row = document.createElement("div");
  row.className = "message-row bou-row";
  row.style.animation = "none";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const card = document.createElement("div");
  card.className = "img-card";

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = prompt;
  img.style.cssText = "width:100%;aspect-ratio:1/1;object-fit:cover;display:block;border-radius:0";

  const footer = document.createElement("div");
  footer.className = "img-card-footer";

  const promptEl = document.createElement("span");
  promptEl.className = "img-card-prompt";
  promptEl.textContent = prompt;

  const dlBtn = document.createElement("button");
  dlBtn.className = "img-download-btn";
  dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download`;
  dlBtn.onclick = () => downloadImage(imageUrl, prompt);

  footer.appendChild(promptEl);
  footer.appendChild(dlBtn);
  card.appendChild(img);
  card.appendChild(footer);
  wrap.appendChild(card);

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = "";
  wrap.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
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
  clearPendingFile();

  const chat = getActiveChat();
  if (!chat) return;

  const isFirstMessage = chat.messages.length === 0;

  // Save user message
  chat.messages.push({ role: "user", content: text, ts: new Date().toISOString() });
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
      body: JSON.stringify({ message: text, history, memoryContext: buildMemoryPrompt(), fileContext: pendingFile?.fileContext || null }),
      signal: currentController.signal
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      hideThinking();
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
      if (c) { c.messages.push({ role: "assistant", content: errMsg, ts: new Date().toISOString() }); saveChats(); }
    } else if (data.action === "generate_image" && data.prompt) {
      await generateImage(data.prompt, chatId);
    } else if (data.action === "coding" && data.code) {
      hideThinking();
      await showCodeResult(data, chatId, text);
      updateMemoryFromConversation(text, data.code);
    } else if (data.action === "coding_too_long" && data.message) {
      hideThinking();
      await streamResponse(data.message, chatId);
    } else {
      hideThinking();
      await streamResponse(data.reply, chatId);
      updateMemoryFromConversation(text, data.reply);
    }
  } catch (err) {
    hideThinking();
    if (err.name !== "AbortError") {
      const errMsg = "⚠️ Could not reach the server. Make sure you have a valid API key set in Vercel.";
      appendMessageRow("bou", errMsg, true);
      const c = chats.find(x => x.id === chatId);
      if (c) { c.messages.push({ role: "assistant", content: errMsg, ts: new Date().toISOString() }); saveChats(); }
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

  // Refresh memory summary whenever Info page is shown
  document.querySelectorAll('.nav-item[data-page="info"]').forEach(el => {
    el.addEventListener("click", refreshMemoryDisplay);
  });
});

// ===========================
// MEMORY UI
// ===========================
function refreshMemoryDisplay() {
  const el = document.getElementById("memorySummaryText");
  if (!el) return;
  const summary = getMemorySummary();
  el.textContent = summary.join("\n");
}

function handleClearMemory() {
  if (!confirm("Clear all of Bou\'s memory about you? This cannot be undone.")) return;
  clearMemory();
  refreshMemoryDisplay();
}

// ===========================
// FILE UPLOAD
// ===========================
async function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = "";

  const MAX_SIZE = 4 * 1024 * 1024; // 4MB (Gemini limit)
  if (file.size > MAX_SIZE) {
    alert("Image is too large. Please upload an image under 4MB.");
    return;
  }

  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    alert("Only image files are supported (JPG, PNG, WEBP, GIF).");
    return;
  }

  showFilePreview(file.name, "image", true);

  try {
    const base64 = await toBase64(file);

    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType: file.type, fileName: file.name })
    });
    const data = await res.json();

    if (data.error) {
      clearPendingFile();
      alert("Could not read image: " + data.error);
      return;
    }

    pendingFile = {
      fileContext: data.fileContext,
      fileName: file.name,
      fileType: "image"
    };
    showFilePreview(file.name, "image", false);
    updateSendBtn();
  } catch (err) {
    clearPendingFile();
    alert("Error reading image. Please try again.");
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showFilePreview(fileName, type, loading = false) {
  const bar = document.getElementById("filePreviewBar");
  const info = document.getElementById("filePreviewInfo");
  if (!bar || !info) return;

  const icons = {
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    pdf:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    file:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
  };

  info.innerHTML = `${icons[type] || icons.file} ${escHtml(fileName)}${loading ? " — Reading…" : " — Ready"}`;
  bar.style.display = "block";
}

function clearPendingFile() {
  pendingFile = null;
  const bar = document.getElementById("filePreviewBar");
  if (bar) bar.style.display = "none";
  updateSendBtn();
}

// ===========================
// IMAGE ZOOM
// ===========================
function openZoom(url) {
  const modal = document.getElementById("zoomModal");
  const img   = document.getElementById("zoomImg");
  if (!modal || !img) return;
  img.src = url;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeZoom() {
  const modal = document.getElementById("zoomModal");
  if (modal) modal.classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeZoom(); });

// ===========================
// IMAGE DOWNLOAD (direct)
// ===========================
async function downloadImageDirect(url, prompt) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = (prompt || "image").slice(0, 40).replace(/[^a-z0-9]/gi, "_") + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    // Fallback if CORS blocks blob download
    const a = document.createElement("a");
    a.href = url;
    a.download = (prompt || "image").slice(0, 40).replace(/[^a-z0-9]/gi, "_") + ".png";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// ===========================
// IMAGE REGENERATE
// ===========================
async function regenerateImage(prompt, chatId, cardEl) {
  if (!prompt || !cardEl) return;

  const newSeed = Date.now();
  const newUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${newSeed}`;

  // Disable regen button and show loading state
  const regenBtn = cardEl.querySelector(".img-action-btn.regen");
  if (regenBtn) {
    regenBtn.disabled = true;
    regenBtn.style.opacity = "0.5";
  }

  // Blur existing image while loading
  const imgEl = cardEl.querySelector("img");
  if (imgEl) {
    imgEl.style.opacity = "0.3";
    imgEl.style.filter  = "blur(6px)";
    imgEl.style.transition = "opacity 0.3s, filter 0.3s";
  }

  // Preload new image
  const newImg = new Image();
  newImg.crossOrigin = "anonymous";
  newImg.src = newUrl;

  await new Promise(resolve => {
    newImg.onload  = resolve;
    newImg.onerror = resolve;
    setTimeout(resolve, 25000);
  });

  // Swap in new image
  if (imgEl && newImg.naturalWidth > 0) {
    imgEl.src = newUrl;
    imgEl.style.opacity = "1";
    imgEl.style.filter  = "";
    imgEl.onclick = () => openZoom(newUrl);
  } else if (imgEl) {
    // Failed — restore original
    imgEl.style.opacity = "1";
    imgEl.style.filter  = "";
  }

  // Re-enable regen button and update handlers
  if (regenBtn) {
    regenBtn.disabled = false;
    regenBtn.style.opacity = "";
    regenBtn.onclick = () => regenerateImage(prompt, chatId, cardEl);
  }

  const dlBtn = cardEl.querySelector(".img-action-btn.download");
  if (dlBtn && newImg.naturalWidth > 0) {
    dlBtn.onclick = () => downloadImageDirect(newUrl, prompt);
  }

  // Update saved URL in chat history
  if (chatId && newImg.naturalWidth > 0) {
    const c = chats.find(x => x.id === chatId);
    if (c) {
      // Find last image message and update it
      for (let i = c.messages.length - 1; i >= 0; i--) {
        if (c.messages[i].content && c.messages[i].content.startsWith("[image:")) {
          c.messages[i].content = `[image:${newUrl}:${prompt}]`;
          saveChats();
          break;
        }
      }
    }
  }
}

// ===========================
// UPDATED generateImage
// (fixes "can't generate second image" bug)
// ===========================
async function generateImage(prompt, chatId) {
  hideThinking();
  showThinking("image");

  const seed    = Date.now();
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${seed}`;

  const row = document.createElement("div");
  row.className = "message-row bou-row";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const shimmerCard = document.createElement("div");
  shimmerCard.className = "img-generating";
  shimmerCard.innerHTML = `
    <div class="img-shimmer">
      <div class="img-shimmer-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <span class="img-shimmer-text">Generating image...</span>
    </div>`;

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = getTime();

  wrap.appendChild(shimmerCard);
  wrap.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();

  // Load image
  const img = new Image();
  img.src = imageUrl;
  img.alt = prompt;

  await new Promise(resolve => {
    img.onload  = resolve;
    img.onerror = resolve;
    setTimeout(resolve, 20000);
  });

  hideThinking();

  if (img.complete && img.naturalWidth > 0) {
    // Success — build card
    const card = document.createElement("div");
    card.className = "img-card";

    img.style.cssText = "width:100%;aspect-ratio:1/1;object-fit:cover;display:block;border-radius:0;cursor:zoom-in";
    img.onclick = () => openZoom(imageUrl);

    const footer = document.createElement("div");
    footer.className = "img-card-footer";

    const promptEl = document.createElement("span");
    promptEl.className = "img-card-prompt";
    promptEl.textContent = prompt;

    const dlBtn = document.createElement("button");
    dlBtn.className = "img-action-btn download";
    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download`;
    dlBtn.onclick = () => downloadImageDirect(imageUrl, prompt);

    const regenBtn = document.createElement("button");
    regenBtn.className = "img-action-btn regen";
    regenBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>Regenerate`;
    regenBtn.onclick = () => regenerateImage(prompt, chatId, card);

    footer.appendChild(promptEl);
    footer.appendChild(dlBtn);
    footer.appendChild(regenBtn);
    card.appendChild(img);
    card.appendChild(footer);
    shimmerCard.replaceWith(card);

    // Save
    const c = chats.find(x => x.id === chatId);
    if (c) {
      c.messages.push({ role: "assistant", content: `[image:${imageUrl}:${prompt}]`, ts: new Date().toISOString() });
      saveChats();
    }
  } else {
    const errEl = document.createElement("div");
    errEl.className = "img-error";
    errEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Could not generate the image. Please try again.`;
    shimmerCard.replaceWith(errEl);
  }
  scrollToBottom();

  // ✅ KEY FIX: Reset loading state so user can send again without refresh
  setLoadingState(false);
  updateSendBtn();
  inputEl.focus();
}

// ===========================
// CODE RESULT (collapsible panel)
// ===========================
async function showCodeResult(data, chatId, userText) {
  const { language, filename, task, code } = data;

  const row = document.createElement("div");
  row.className = "message-row bou-row";
  row.style.animation = "none";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";
  wrap.style.maxWidth = "calc(100% - 44px)";

  // Code result card — no collapsible panel, show directly
  const card = document.createElement("div");
  card.className = "code-result-card";

  const header = document.createElement("div");
  header.className = "code-result-header";
  header.innerHTML = `
    <div class="code-result-meta">
      <span class="code-result-lang">${escHtml(language)}</span>
      <span class="code-result-task">${escHtml(filename || task || "")}</span>
    </div>
    <div class="code-result-actions">
      <button class="code-action-btn copy" onclick="copyCodeResult(this, ${JSON.stringify(code)})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy
      </button>
      <button class="code-action-btn download" onclick="downloadCode(${JSON.stringify(code)}, ${JSON.stringify(filename || 'code.' + language)})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download
      </button>
    </div>`;

  const pre = document.createElement("pre");
  pre.className = "code-result-pre";
  const codeEl = document.createElement("code");
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  card.appendChild(header);
  card.appendChild(pre);

  const ts = new Date().toISOString();
  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = getTime();

  wrap.appendChild(card);
  wrap.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();

  // Save to chat history with timestamp
  const c = chats.find(x => x.id === chatId);
  if (c) {
    c.messages.push({ role: "assistant", content: "```" + language + "\n" + code + "\n```", ts });
    saveChats();
  }
}

function toggleThinkingPanel(panel) {
  panel.classList.toggle("open");
}

function copyCodeResult(btn, code) {
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`;
      btn.classList.remove("copied");
    }, 2000);
  });
}

function downloadCode(code, filename) {
  const blob = new Blob([code], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// Also update renderImageMessage to include zoom + regen + direct download
function renderImageMessage(imageUrl, prompt) {
  const row = document.createElement("div");
  row.className = "message-row bou-row";
  row.style.animation = "none";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<img src="/images/bou-avatar.png" alt="Bou" />`;

  const wrap = document.createElement("div");
  wrap.className = "msg-content";

  const card = document.createElement("div");
  card.className = "img-card";

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = prompt;
  img.style.cssText = "width:100%;aspect-ratio:1/1;object-fit:cover;display:block;border-radius:0;cursor:zoom-in";
  img.onclick = () => openZoom(imageUrl);

  const footer = document.createElement("div");
  footer.className = "img-card-footer";

  const promptEl = document.createElement("span");
  promptEl.className = "img-card-prompt";
  promptEl.textContent = prompt;

  const dlBtn = document.createElement("button");
  dlBtn.className = "img-action-btn download";
  dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download`;
  dlBtn.onclick = () => downloadImageDirect(imageUrl, prompt);

  const regenBtn = document.createElement("button");
  regenBtn.className = "img-action-btn regen";
  regenBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>Regenerate`;
  regenBtn.onclick = () => regenerateImage(prompt, null, card);

  footer.appendChild(promptEl);
  footer.appendChild(dlBtn);
  footer.appendChild(regenBtn);
  card.appendChild(img);
  card.appendChild(footer);
  wrap.appendChild(card);

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = "";
  wrap.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
}
