(() => {
  // ── DOM refs ───────────────────────────────────────────────────────────
  const form       = document.getElementById('chat-form');
  const input      = document.getElementById('user-input');
  const chatBox    = document.getElementById('chat-box');
  const sendBtn    = document.getElementById('send-btn');
  const clearBtn   = document.getElementById('clear-btn');
  const popover    = document.getElementById('chat-popover');
  const backdrop   = document.getElementById('chat-backdrop');
  const fab        = document.getElementById('fab');
  const chatToggle = document.getElementById('chat-toggle');
  const closeBtn   = document.getElementById('chat-close');
  const openHero   = document.getElementById('open-chat-hero');

  // ── State ──────────────────────────────────────────────────────────────
  const conversation = [];
  let isOpen = false;

  // ══════════════════════════════════════════════
  // MARKDOWN → HTML (lightweight, no library)
  // ══════════════════════════════════════════════
  function parseMarkdown(text) {
    // Escape raw HTML first to prevent XSS
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // --- Block-level ---

    // Horizontal rule: ---
    html = html.replace(/^---+$/gm, '<hr>');

    // ### Heading 3
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    // ## Heading 2
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    // # Heading 1
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Unordered lists: lines starting with * or -
    // Group consecutive list lines into <ul>
    html = html.replace(/((?:^[ \t]*[-*][ \t].+\n?)+)/gm, (block) => {
      const items = block
        .trim()
        .split('\n')
        .map(line => line.replace(/^[ \t]*[-*][ \t]/, '').trim())
        .filter(Boolean)
        .map(item => `<li>${item}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists: lines starting with 1. 2. etc
    html = html.replace(/((?:^[ \t]*\d+\.[ \t].+\n?)+)/gm, (block) => {
      const items = block
        .trim()
        .split('\n')
        .map(line => line.replace(/^[ \t]*\d+\.[ \t]/, '').trim())
        .filter(Boolean)
        .map(item => `<li>${item}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    });

    // --- Inline ---

    // Bold+italic ***text***
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic *text* (only single asterisks not adjacent to list items)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // --- Paragraphs ---
    // Wrap lines that aren't already block-level tags
    const blockTags = /^<(h[1-3]|ul|ol|li|hr|blockquote)/;
    html = html
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return ''; // blank → spacer handled below
        if (blockTags.test(trimmed)) return trimmed;
        return `<p>${trimmed}</p>`;
      })
      .join('\n');

    // Collapse multiple blank lines → single break between blocks
    html = html.replace(/(\n\s*){2,}/g, '\n');

    return html;
  }

  // ── Popover open/close ────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    popover.classList.add('open');
    popover.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('visible');
    fab.classList.add('hidden');
    setTimeout(() => input.focus(), 350);
  }

  function closeChat() {
    isOpen = false;
    popover.classList.remove('open');
    popover.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('visible');
    fab.classList.remove('hidden');
  }

  fab?.addEventListener('click', openChat);
  chatToggle?.addEventListener('click', openChat);
  openHero?.addEventListener('click', openChat);
  closeBtn?.addEventListener('click', closeChat);
  backdrop?.addEventListener('click', closeChat);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) closeChat(); });

  // ── Helpers ────────────────────────────────────────────────────────────
  function removeChips() {
    document.getElementById('chips')?.remove();
  }

  // Append a user bubble (plain text, safe)
  function appendUserMessage(text) {
    removeChips();
    const el = document.createElement('div');
    el.classList.add('message', 'message--user');
    el.textContent = text; // plain text for user input
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return el;
  }

  // Append a bot bubble with rendered Markdown
  function appendBotMessage(markdownText, isError = false) {
    const el = document.createElement('div');
    el.classList.add('message', 'message--bot');
    if (isError) el.classList.add('message--error');
    el.innerHTML = parseMarkdown(markdownText);
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return el;
  }

  function appendThinking() {
    const el = document.createElement('div');
    el.classList.add('thinking-dots');
    el.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return el;
  }

  function setLoading(on) {
    input.disabled   = on;
    sendBtn.disabled = on;
  }

  // ── Core send ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    if (!isOpen) openChat();

    appendUserMessage(text);
    conversation.push({ role: 'user', text });

    setLoading(true);
    const thinkEl = appendThinking();

    try {
      const res = await fetch('/api/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ conversation }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      if (!data.result) throw new Error('Respons kosong dari server');

      thinkEl.remove();
      appendBotMessage(data.result);
      conversation.push({ role: 'model', text: data.result });

    } catch (err) {
      console.error('[JogjaGuide]', err.message);
      thinkEl.remove();
      const msg = err instanceof TypeError
        ? 'Gagal terhubung. Cek koneksimu ya!'
        : `Maaf, ada masalah: ${err.message}`;
      appendBotMessage(msg, true);
      conversation.pop();
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  // ── Form submit ────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    await sendMessage(text);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ── Quick chips + strip buttons ───────────────────────────────────────
  document.querySelectorAll('.chip, [data-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (!prompt) return;
      input.value = '';
      sendMessage(prompt);
    });
  });

  // ── Clear chat ─────────────────────────────────────────────────────────
  clearBtn?.addEventListener('click', () => {
    conversation.length = 0;
    chatBox.innerHTML = `
      <div class="popover__welcome">
        <p class="popover__welcome-emoji">🗺️</p>
        <p class="popover__welcome-text">
          <strong>Halo! Saya JogjaGuide.</strong><br>
          Tanya apa saja seputar wisata Yogyakarta — destinasi, kuliner, hotel, atau itinerary!
        </p>
      </div>
      <div class="chips" id="chips">
        <button class="chip" data-prompt="Rekomendasikan kuliner khas Jogja yang wajib dicoba">🍜 Kuliner Jogja</button>
        <button class="chip" data-prompt="Itinerary 2 hari di Jogja untuk pasangan">📅 Itinerary</button>
        <button class="chip" data-prompt="Hotel murah tapi nyaman di Jogja">🏨 Hotel</button>
        <button class="chip" data-prompt="Apa oleh-oleh khas Jogja yang populer?">🎁 Oleh-oleh</button>
      </div>`;

    chatBox.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
    });

    input.focus();
  });

})();