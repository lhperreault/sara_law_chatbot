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

  // Language detection — Spanish if the URL contains /es/
  const IS_SPANISH = (function () {
    var p = (location.pathname || "").toLowerCase();
    return p.indexOf("/es/") !== -1 || p.indexOf("/espanol") !== -1;
  })();
  const LANG = IS_SPANISH ? "es" : "en";

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
    @keyframes law-bubble-bounce {
      0%, 100% { transform: translateY(0); }
      30% { transform: translateY(-14px); }
      50% { transform: translateY(-6px); }
      70% { transform: translateY(-10px); }
    }
    #law-chat-bubble.law-bouncing { animation: law-bubble-bounce .6s ease 2; }
    #law-chat-bubble img {
      width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
    }

    /* Teaser tooltip */
    #law-chat-teaser {
      position: fixed !important;
      bottom: 120px !important; right: 24px !important;
      top: auto !important; left: auto !important;
      z-index: 2147483646 !important;
      background: #fff;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px; font-weight: 500;
      line-height: 1.4;
      padding: 12px 18px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      max-width: 240px;
      cursor: pointer;
      opacity: 0; transform: translateY(10px) scale(0.95);
      transition: opacity .3s ease, transform .3s ease;
      pointer-events: none;
    }
    #law-chat-teaser.law-teaser-visible {
      opacity: 1; transform: translateY(0) scale(1);
      pointer-events: all;
    }
    #law-chat-teaser::after {
      content: '';
      position: absolute; bottom: -7px; right: 30px;
      width: 14px; height: 14px;
      background: #fff;
      transform: rotate(45deg);
      box-shadow: 3px 3px 6px rgba(0,0,0,0.06);
    }
    #law-chat-teaser-close {
      position: absolute; top: 4px; right: 8px;
      background: none; border: none;
      color: #aaa; font-size: 16px; cursor: pointer;
      line-height: 1; padding: 2px 4px;
    }
    #law-chat-teaser-close:hover { color: #666; }
    @media (max-width: 640px) {
      #law-chat-teaser { bottom: 96px !important; max-width: 200px; font-size: 13px; padding: 10px 14px; }
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

  // Teaser tooltip — floats above the bubble to grab attention
  const teaser = document.createElement("div");
  teaser.id = "law-chat-teaser";
  teaser.innerHTML =
    '<button id="law-chat-teaser-close" aria-label="Dismiss">&times;</button>' +
    '<div style="margin-right:14px;">Hello! \uD83D\uDC4B Get help from our <strong>live agent</strong>.</div>';

  // Append to <html> rather than <body> so we escape any ancestor with
  // `transform`, `filter`, `perspective`, or `will-change` set — those make
  // `position: fixed` anchor to the ancestor's box instead of the viewport.
  const mountTarget = document.documentElement || document.body;
  mountTarget.appendChild(bubble);
  mountTarget.appendChild(teaser);
  mountTarget.appendChild(win);

  // ─── Element refs ─────────────────────────────────────────────────────────
  const messagesEl = win.querySelector("#law-chat-messages");
  const inputRow = win.querySelector("#law-chat-input-row");
  const inputEl = win.querySelector("#law-chat-input");
  const sendBtn = win.querySelector("#law-chat-send");
  const resetBtn = win.querySelector("#law-reset-btn");
  const resetConfirm = win.querySelector("#law-reset-confirm");

  // Apply Spanish labels to static UI elements if needed
  if (IS_SPANISH) {
    inputEl.setAttribute("placeholder", "Escribe un mensaje...");
    var subtitleEl = win.querySelector("#law-chat-header-text p");
    if (subtitleEl) subtitleEl.textContent = "En l\u00EDnea - gratis y confidencial";
  }

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

      const greeting = IS_SPANISH
        ? "\u00A1Hola \uD83D\uDC4B! Bienvenido a The Roque Law Firm.\n" +
          "Estoy aqu\u00ED para responder sus preguntas, guiarlo en su caso de lesi\u00F3n personal o defensa criminal, y conectarlo con nuestro equipo \u2014 \u00A1generalmente toma menos de 2 minutos!\n\n" +
          "Antes de comenzar\u2026 \u00BFcu\u00E1l es su nombre?"
        : "Hello \uD83D\uDC4B! Welcome to The Roque Law Firm.\n" +
          "I'm here to answer any questions, guide you in handling your personal injury or criminal defense, and connect you with our team \u2014 usually takes less than 2 minutes!\n\n" +
          "Before we dive in\u2026 what's your first name?";
      addMessage("bot", greeting);
      messages.push({ role: "assistant", content: greeting });
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
      // Send the full client-side history so the backend is stateless and
      // the LLM always sees the complete conversation. Exclude the just-
      // pushed user message from history (it's passed separately as `message`)
      // and drop the very first seeded greeting nothing if desired.
      const historyToSend = messages
        .slice(0, -1)
        .filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && m.content; })
        .map(function (m) { return { role: m.role, content: m.content }; });

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          client_email: clientInfo.email,
          message: text.trim(),
          practice_area: PRACTICE_AREA,
          language: LANG,
          history: historyToSend,
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

  // Teaser: after 3s, bounce the bubble and show a small tooltip.
  // Clicking the tooltip or bubble opens the full chat. Dismissing the
  // tooltip (X) hides it but keeps the bubble. Once per session.
  const TEASER_KEY = "law-chat-teaser-shown";
  var teaserDismissed = false;  // user explicitly clicked X
  var teaserRound = 0;         // how many times we've shown the teaser (max 3)

  var TEASER_MESSAGES = IS_SPANISH
    ? [
        "\u00A1Hola! \uD83D\uDC4B Obtenga ayuda de nuestro <strong>agente en vivo</strong>.",
        "\u00BFTiene preguntas? Estamos aqu\u00ED para ayudar \u2014 <strong>gratis y confidencial</strong>.",
        "No espere \u2014 obtenga una <strong>revisi\u00F3n de caso gratis</strong> en menos de 2 minutos."
      ]
    : [
        "Hello! \uD83D\uDC4B Get help from our <strong>live agent</strong>.",
        "Still have questions? We're here to help \u2014 <strong>free & confidential</strong>.",
        "Don't wait \u2014 get a <strong>free case review</strong> in under 2 minutes."
      ];

  function hideTeaser() {
    teaser.classList.remove("law-teaser-visible");
  }

  function bounceBubble() {
    bubble.classList.remove("law-bouncing");
    // Force reflow so the animation restarts
    void bubble.offsetWidth;
    bubble.classList.add("law-bouncing");
  }

  function showTeaser() {
    // Stop if: chat is open, user dismissed, or we've shown all 3 rounds
    if (isOpen || teaserDismissed || teaserRound >= 3) return;

    var msg = TEASER_MESSAGES[teaserRound] || TEASER_MESSAGES[0];
    teaserRound++;

    // Update message text (keep the close button)
    teaser.innerHTML =
      '<button id="law-chat-teaser-close" aria-label="Dismiss">&times;</button>' +
      '<div style="margin-right:14px;">' + msg + '</div>';

    // Re-bind close button since we replaced innerHTML
    teaser.querySelector("#law-chat-teaser-close").addEventListener("click", function (e) {
      e.stopPropagation();
      teaserDismissed = true;
      hideTeaser();
    });

    // Bounce + show tooltip
    bounceBubble();
    teaser.classList.add("law-teaser-visible");

    // Auto-hide after 8 seconds, then schedule next round if applicable
    setTimeout(function () {
      if (!isOpen) hideTeaser();
      // Schedule next round after 15 seconds (if rounds remain)
      if (teaserRound < 3 && !isOpen && !teaserDismissed) {
        setTimeout(showTeaser, 15000);
      }
    }, 8000);
  }

  // Clicking the teaser opens chat
  teaser.addEventListener("click", function (e) {
    if (e.target.id === "law-chat-teaser-close") return; // handled above
    teaserDismissed = true;
    hideTeaser();
    openChat();
  });

  // Hide teaser when chat opens via bubble click
  bubble.addEventListener("click", function () {
    teaserDismissed = true;
    hideTeaser();
  });

  // Fire the first teaser 3 seconds after load (once per session)
  function scheduleTeaser() {
    try { if (sessionStorage.getItem(TEASER_KEY)) return; } catch {}
    try { sessionStorage.setItem(TEASER_KEY, "1"); } catch {}
    setTimeout(showTeaser, 3000);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    scheduleTeaser();
  } else {
    window.addEventListener("DOMContentLoaded", scheduleTeaser);
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
