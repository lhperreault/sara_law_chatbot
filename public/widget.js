/**
 * Law Firm Client Chatbot Widget
 *
 * Embeddable chat widget adapted from LP Pressure Washing chatbot.
 * Features: pre-chat email form, configurable branding, server-driven suggestions.
 *
 * Usage:
 *   <script src="https://YOUR_SERVER/widget.js"
 *     data-firm-name="Your Law Firm"
 *     data-primary-color="#1e3a5f"
 *     data-practice-area="immigration"
 *     data-subtitle="Online - usually replies instantly">
 *   </script>
 */

(function () {
  // ─── Configuration from data attributes ──────────────────────────────────
  const scriptTag = document.currentScript;
  const ORIGIN = scriptTag?.src ? new URL(scriptTag.src).origin : "";
  const API_URL = ORIGIN + "/api/chat";
  const LOOKUP_URL = ORIGIN + "/api/clients/lookup";
  const STORAGE_KEY = "law-chat-session";

  const FIRM_NAME = scriptTag?.getAttribute("data-firm-name") || "Legal Assistant";
  const PRIMARY_COLOR = scriptTag?.getAttribute("data-primary-color") || "#1e3a5f";
  const PRACTICE_AREA = scriptTag?.getAttribute("data-practice-area") || "immigration";
  const SUBTITLE = scriptTag?.getAttribute("data-subtitle") || "Online - usually replies instantly";
  // Default to the backend-served logos. LOGO_URL is the wide wordmark
  // (header). BUBBLE_LOGO_URL is the square-cropped dog head (floating bubble).
  const LOGO_URL = scriptTag?.getAttribute("data-logo-url") || (ORIGIN + "/logo.png");
  const BUBBLE_LOGO_URL = scriptTag?.getAttribute("data-bubble-logo-url") || (ORIGIN + "/logo-bubble.png");

  // ─── State ────────────────────────────────────────────────────────────────
  const messages = [];
  let isOpen = false;
  let isWaiting = false;
  let clientInfo = null;
  let conversationId = null;
  let identified = false; // Has the user submitted the pre-chat form?

  // ─── LocalStorage helpers ─────────────────────────────────────────────────
  function saveSession() {
    const data = { messages, clientInfo, conversationId, identified, ts: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expire after midnight
      const saved = new Date(data.ts);
      if (saved.toDateString() !== new Date().toDateString()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #law-chat-bubble {
      position: fixed !important;
      bottom: 24px !important; right: 24px !important;
      top: auto !important; left: auto !important;
      z-index: 2147483646 !important;
      width: 88px; height: 88px; border-radius: 50%;
      background: ${PRIMARY_COLOR}; border: none; padding: 0;
      box-shadow: 0 6px 22px rgba(0,0,0,0.28);
      cursor: pointer; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
      font-size: 36px; color: #fff;
    }
    @media (max-width: 640px) {
      #law-chat-bubble { width: 64px; height: 64px; font-size: 28px; }
    }
    #law-chat-bubble:hover { transform: scale(1.08); }
    #law-chat-bubble img {
      width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
    }
    #law-chat-window {
      position: fixed !important;
      bottom: 100px !important; right: 24px !important;
      top: auto !important; left: auto !important;
      z-index: 2147483647 !important;
      width: 420px; max-width: calc(100vw - 32px);
      height: 560px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: opacity 0.2s, transform 0.2s;
    }
    #law-chat-window.law-hidden {
      opacity: 0; transform: translateY(12px); pointer-events: none;
    }
    #law-chat-header {
      background: ${PRIMARY_COLOR}; color: #fff;
      padding: 10px 18px; display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    .law-header-icon {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .law-header-logo {
      height: 40px; width: auto; max-width: 180px;
      object-fit: contain; flex-shrink: 0;
    }
    #law-chat-header-text h4 { margin: 0; font-size: 15px; font-weight: 600; }
    #law-chat-header-text p  { margin: 0; font-size: 12px; opacity: 0.85; }
    #law-chat-close {
      margin-left: auto; background: none; border: none;
      color: #fff; font-size: 20px; cursor: pointer; padding: 0 4px;
      opacity: 0.8; line-height: 1;
    }
    #law-chat-close:hover { opacity: 1; }

    /* Messages */
    #law-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      background: #f8fafc;
    }
    #law-chat-messages::-webkit-scrollbar { width: 4px; }
    #law-chat-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

    .law-msg-row {
      display: flex; align-items: flex-end; gap: 8px;
      align-self: flex-start; max-width: 88%;
    }
    .law-msg-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: ${PRIMARY_COLOR}; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
    }
    .law-msg {
      padding: 10px 14px; border-radius: 14px; font-size: 14px;
      line-height: 1.5; word-break: break-word; white-space: pre-wrap;
    }
    .law-msg-bot {
      background: #fff; color: #1e293b;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .law-msg-user {
      background: ${PRIMARY_COLOR}; color: #fff;
      border-bottom-right-radius: 4px;
      align-self: flex-end; max-width: 82%;
    }

    /* Suggestions */
    .law-suggestions {
      display: flex; flex-wrap: wrap; gap: 6px;
      align-self: flex-start; padding-left: 36px;
    }
    .law-suggestion-btn {
      background: #fff; color: #64748b; border: 1.5px solid #cbd5e1;
      border-radius: 20px; padding: 6px 14px; font-size: 13px;
      cursor: pointer; font-family: inherit;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .law-suggestion-btn:hover {
      background: #f1f5f9; color: #1e293b; border-color: #94a3b8;
    }

    /* Typing indicator */
    .law-typing-row { display: flex; align-items: flex-end; gap: 8px; align-self: flex-start; }
    .law-typing {
      display: flex; gap: 4px; align-items: center;
      padding: 10px 14px; background: #fff;
      border-radius: 14px; border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .law-typing span {
      width: 7px; height: 7px; background: #94a3b8;
      border-radius: 50%; animation: law-bounce 1.2s infinite;
    }
    .law-typing span:nth-child(2) { animation-delay: 0.2s; }
    .law-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes law-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    /* Input row */
    #law-chat-input-row {
      display: flex; gap: 8px; padding: 12px;
      background: #fff; border-top: 1px solid #e2e8f0; flex-shrink: 0;
    }
    #law-chat-input-row.law-input-hidden { display: none; }
    #law-chat-input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 9px 13px; font-size: 16px; outline: none;
      resize: none; font-family: inherit; line-height: 1.4;
      max-height: 90px; overflow-y: auto;
      color: #0f172a;
    }
    #law-chat-input::placeholder { color: #94a3b8; }
    #law-chat-input:focus { border-color: ${PRIMARY_COLOR}; }
    #law-chat-send {
      background: ${PRIMARY_COLOR}; color: #fff; border: none;
      border-radius: 10px; padding: 0 14px;
      cursor: pointer; font-size: 18px; flex-shrink: 0;
      transition: background 0.15s;
    }
    #law-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Footer */
    #law-chat-footer {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; padding: 4px 0 8px; background: #fff; flex-shrink: 0;
    }
    #law-powered { font-size: 11px; color: #94a3b8; }
    #law-reset-btn {
      background: none; border: none; color: #cbd5e1;
      font-size: 13px; cursor: pointer; padding: 0 4px;
      transition: color 0.15s; line-height: 1;
    }
    #law-reset-btn:hover { color: #94a3b8; }
    #law-reset-confirm {
      display: none; font-size: 11px; color: #ef4444;
      cursor: pointer; background: none; border: none;
      font-family: inherit; padding: 0 4px;
    }
    #law-reset-confirm:hover { text-decoration: underline; }

    @media (max-width: 500px) {
      #law-chat-window { bottom: 50px; }
    }
  `;
  document.head.appendChild(style);

  // ─── DOM ──────────────────────────────────────────────────────────────────
  const bubble = document.createElement("button");
  bubble.id = "law-chat-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  if (BUBBLE_LOGO_URL) {
    bubble.innerHTML = '<img src="' + BUBBLE_LOGO_URL + '" alt="Chat" onerror="this.parentNode.innerHTML=\'\\u2696\\uFE0F\'">';
  } else {
    bubble.innerHTML = "\u2696\uFE0F"; // Balance scale emoji
  }

  const win = document.createElement("div");
  win.id = "law-chat-window";
  win.classList.add("law-hidden");
  win.innerHTML = `
    <div id="law-chat-header">
      ${LOGO_URL
        ? '<img class="law-header-logo" src="' + LOGO_URL + '" alt="' + FIRM_NAME + '" onerror="this.style.display=\'none\'">'
        : '<div class="law-header-icon">\u2696\uFE0F</div>'}
      <div id="law-chat-header-text">
        <p>${SUBTITLE}</p>
      </div>
      <button id="law-chat-close" aria-label="Close chat">\u2715</button>
    </div>
    <div id="law-chat-messages"></div>
    <div id="law-chat-input-row">
      <textarea id="law-chat-input" rows="1" placeholder="Type a message..."></textarea>
      <button id="law-chat-send" aria-label="Send">\u27A4</button>
    </div>
    <div id="law-chat-footer">
      <span id="law-powered">Powered by AI Legal Assistant</span>
      <button id="law-reset-btn" title="Reset chat">\u21BB</button>
      <button id="law-reset-confirm">Reset chat?</button>
    </div>
  `;

  // Append to <html> rather than <body> so we escape any ancestor with
  // `transform`, `filter`, `perspective`, or `will-change` set — those make
  // `position: fixed` anchor to the ancestor's box instead of the viewport.
  const mountTarget = document.documentElement || document.body;
  mountTarget.appendChild(bubble);
  mountTarget.appendChild(win);

  // ─── Element refs ─────────────────────────────────────────────────────────
  const messagesEl = win.querySelector("#law-chat-messages");
  const inputRow = win.querySelector("#law-chat-input-row");
  const inputEl = win.querySelector("#law-chat-input");
  const sendBtn = win.querySelector("#law-chat-send");
  const resetBtn = win.querySelector("#law-reset-btn");
  const resetConfirm = win.querySelector("#law-reset-confirm");

  // ─── UI helpers ───────────────────────────────────────────────────────────
  function addMessage(role, text) {
    if (role === "user") {
      const div = document.createElement("div");
      div.className = "law-msg law-msg-user";
      div.textContent = text;
      messagesEl.appendChild(div);
    } else {
      const row = document.createElement("div");
      row.className = "law-msg-row";
      row.innerHTML = '<div class="law-msg-avatar">R</div>';
      const msgBubble = document.createElement("div");
      msgBubble.className = "law-msg law-msg-bot";
      msgBubble.textContent = text;
      row.appendChild(msgBubble);
      messagesEl.appendChild(row);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addSuggestions(options) {
    if (!options || options.length === 0) return;
    const container = document.createElement("div");
    container.className = "law-suggestions";
    options.forEach(function (opt) {
      const btn = document.createElement("button");
      btn.className = "law-suggestion-btn";
      btn.textContent = opt;
      btn.addEventListener("click", function () {
        container.remove();
        sendMessage(opt);
      });
      container.appendChild(btn);
    });
    messagesEl.appendChild(container);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const row = document.createElement("div");
    row.className = "law-typing-row";
    row.id = "law-typing-indicator";
    row.innerHTML = '<div class="law-msg-avatar">R</div><div class="law-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById("law-typing-indicator");
    if (el) el.remove();
  }

  // ─── Auto-initialize conversation on first open ───────────────────────────
  // No pre-chat form — the widget opens, creates a client record silently,
  // and immediately shows the first bot message asking for name + category.
  async function initConversation() {
    if (identified) return;

    const syntheticEmail = "chat_" + Date.now() + "_" +
      Math.random().toString(36).slice(2, 8) + "@roque-chat.local";

    try {
      const res = await fetch(LOOKUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: syntheticEmail, channel: "website" }),
      });
      const data = await res.json();

      clientInfo = data.client;
      conversationId = data.conversation_id;
      identified = true;

      const greeting = "Hi! What's your name, and are you reaching out about a personal injury or a criminal defense matter?";
      addMessage("bot", greeting);
      messages.push({ role: "assistant", content: greeting });
      addSuggestions(["Personal Injury", "Criminal Defense"]);
      saveSession();
      inputEl.focus();
    } catch (err) {
      addMessage("bot", "Sorry, I couldn't connect. Please refresh and try again.");
    }
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text.trim() || isWaiting || !identified) return;

    // Remove suggestion buttons
    messagesEl.querySelectorAll(".law-suggestions").forEach(function (el) { el.remove(); });

    addMessage("user", text.trim());
    messages.push({ role: "user", content: text.trim() });
    saveSession();
    inputEl.value = "";
    inputEl.style.height = "auto";
    isWaiting = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          client_email: clientInfo.email,
          message: text.trim(),
          practice_area: PRACTICE_AREA,
        }),
      });
      const data = await res.json();
      hideTyping();

      // Update conversation ID if it changed
      if (data.conversation_id) conversationId = data.conversation_id;

      var reply = data.reply || "Sorry, something went wrong. Please try again!";
      addMessage("bot", reply);
      messages.push({ role: "assistant", content: reply });
      saveSession();

      // Server-driven suggestions
      if (data.suggestions) {
        addSuggestions(data.suggestions);
      }
    } catch (err) {
      hideTyping();
      addMessage("bot", "Sorry, I couldn't connect. Please check your internet and try again.");
    }

    isWaiting = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  // ─── Restore session ──────────────────────────────────────────────────────
  function restoreSession(saved) {
    clientInfo = saved.clientInfo;
    conversationId = saved.conversationId;
    identified = saved.identified;

    if (saved.messages) {
      saved.messages.forEach(function (msg) {
        messages.push(msg);
        addMessage(msg.role === "user" ? "user" : "bot", msg.content);
      });
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function resetChat() {
    messages.length = 0;
    messagesEl.innerHTML = "";
    clientInfo = null;
    conversationId = null;
    identified = false;
    clearSession();
    resetConfirm.style.display = "none";
    resetBtn.style.display = "";
    // Start a fresh conversation immediately.
    initConversation();
  }

  resetBtn.addEventListener("click", function () {
    resetBtn.style.display = "none";
    resetConfirm.style.display = "inline";
    setTimeout(function () {
      resetConfirm.style.display = "none";
      resetBtn.style.display = "";
    }, 3000);
  });
  resetConfirm.addEventListener("click", resetChat);

  // ─── Open / Close ─────────────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    win.classList.remove("law-hidden");
    bubble.innerHTML = '<span style="font-size:28px;color:#fff;">\u2715</span>';

    if (!identified) {
      var saved = loadSession();
      if (saved && saved.identified) {
        restoreSession(saved);
      } else {
        initConversation();
      }
    }

    inputEl.focus();
  }

  function closeChat() {
    isOpen = false;
    win.classList.add("law-hidden");
    if (BUBBLE_LOGO_URL) {
      bubble.innerHTML = '<img src="' + BUBBLE_LOGO_URL + '" alt="Chat">';
    } else {
      bubble.innerHTML = "\u2696\uFE0F";
    }
  }

  bubble.addEventListener("click", function () { isOpen ? closeChat() : openChat(); });
  win.querySelector("#law-chat-close").addEventListener("click", closeChat);
  sendBtn.addEventListener("click", function () { sendMessage(inputEl.value); });

  // Auto-open on desktop once per tab session. Skips mobile (<= 640px) and
  // does not re-trigger if the visitor has already opened or dismissed it.
  const AUTO_OPEN_KEY = "law-chat-auto-opened";
  function maybeAutoOpen() {
    try {
      if (sessionStorage.getItem(AUTO_OPEN_KEY)) return;
    } catch {}
    if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) return;
    try { sessionStorage.setItem(AUTO_OPEN_KEY, "1"); } catch {}
    setTimeout(openChat, 1200); // small delay so the page renders first
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    maybeAutoOpen();
  } else {
    window.addEventListener("DOMContentLoaded", maybeAutoOpen);
  }

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + "px";
  });
})();
