(function () {
  // ===== CONFIG — update this after you deploy your backend =====
  const BACKEND_URL = "https://hso-chatbot-g2kl.vercel.app/api/chat";
  // ================================================================

  const COLORS = {
    primary: "#1a5f3f",   // deep island green — change to match your brand
    accent: "#f4a300",    // warm sun-gold accent
    bg: "#ffffff",
    text: "#1a1a1a"
  };

  const style = document.createElement("style");
  style.textContent = `
    #hso-chat-bubble {
      position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;
      border-radius: 50%; background: ${COLORS.primary}; color: white;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.25); z-index: 999999;
      font-size: 26px; transition: transform 0.15s ease;
    }
    #hso-chat-bubble:hover { transform: scale(1.06); }
    #hso-chat-window {
      position: fixed; bottom: 92px; right: 20px; width: 340px; max-width: 92vw;
      height: 480px; max-height: 75vh; background: ${COLORS.bg}; border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3); display: none; flex-direction: column;
      overflow: hidden; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #hso-chat-header {
      background: ${COLORS.primary}; color: white; padding: 14px 16px;
      font-weight: 600; font-size: 15px;
    }
    #hso-chat-header span { display: block; font-weight: 400; font-size: 12px; opacity: 0.85; margin-top: 2px; }
    #hso-chat-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .hso-msg { max-width: 85%; padding: 9px 12px; border-radius: 12px; font-size: 14px; line-height: 1.4; }
    .hso-msg.user { align-self: flex-end; background: ${COLORS.primary}; color: white; border-bottom-right-radius: 3px; }
    .hso-msg.assistant { align-self: flex-start; background: #f0f0f0; color: ${COLORS.text}; border-bottom-left-radius: 3px; }
    #hso-chat-input-row { display: flex; border-top: 1px solid #eee; padding: 10px; gap: 8px; }
    #hso-chat-input {
      flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 9px 14px;
      font-size: 14px; outline: none;
    }
    #hso-chat-send {
      background: ${COLORS.accent}; border: none; color: white; border-radius: 20px;
      padding: 0 16px; font-weight: 600; cursor: pointer; font-size: 14px;
    }
    #hso-chat-send:disabled { opacity: 0.5; cursor: default; }
    .hso-typing { font-size: 13px; color: #888; padding: 0 14px 6px; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement("div");
  bubble.id = "hso-chat-bubble";
  bubble.innerHTML = "☀️";
  document.body.appendChild(bubble);

  const win = document.createElement("div");
  win.id = "hso-chat-window";
  win.innerHTML = `
    <div id="hso-chat-header">
      Hawaii Solar Outfitters
      <span>Usually replies in a few minutes</span>
    </div>
    <div id="hso-chat-messages"></div>
    <div class="hso-typing" style="display:none;" id="hso-typing">typing...</div>
    <div id="hso-chat-input-row">
      <input id="hso-chat-input" type="text" placeholder="Type your message..." />
      <button id="hso-chat-send">Send</button>
    </div>
  `;
  document.body.appendChild(win);

  let messages = [];
  let open = false;

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = "hso-msg " + role;
    div.textContent = text;
    document.getElementById("hso-chat-messages").appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function setTyping(isTyping) {
    document.getElementById("hso-typing").style.display = isTyping ? "block" : "none";
  }

  async function sendMessage(text) {
    messages.push({ role: "user", content: text });
    addMessage("user", text);
    document.getElementById("hso-chat-input").value = "";
    document.getElementById("hso-chat-send").disabled = true;
    setTyping(true);

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      const data = await res.json();
      setTyping(false);
      document.getElementById("hso-chat-send").disabled = false;

      const reply = data.reply || "Sorry, something went wrong — please call or text us directly.";
      messages.push({ role: "assistant", content: reply });
      addMessage("assistant", reply);
    } catch (err) {
      setTyping(false);
      document.getElementById("hso-chat-send").disabled = false;
      // Remove the failed user message so the conversation history stays valid
      // (Anthropic's API requires strict user/assistant alternation) and the
      // visitor can simply try again without the whole chat breaking.
      messages.pop();
      addMessage("assistant", "Sorry, something went wrong. Please try again or reach out directly.");
    }
  }

  bubble.addEventListener("click", () => {
    open = !open;
    win.style.display = open ? "flex" : "none";
    if (open && messages.length === 0) {
      const greeting = "Aloha! Looking into off-grid solar for your East Hawaii property — or need power on land without a permit or HELCO connection? I can help figure out what fits and get you a free, no-pressure site visit. What's going on with your property?";
      messages.push({ role: "assistant", content: greeting });
      addMessage("assistant", greeting);
    }
  });

  document.getElementById("hso-chat-send").addEventListener("click", () => {
    const input = document.getElementById("hso-chat-input");
    if (input.value.trim()) sendMessage(input.value.trim());
  });
  document.getElementById("hso-chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.value.trim()) sendMessage(e.target.value.trim());
  });
})();
