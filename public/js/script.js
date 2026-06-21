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
  const chips      = document.getElementById('chips');

  // ── State ──────────────────────────────────────────────────────────────
  const conversation = [];
  let isOpen = false;

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

  fab.addEventListener('click', openChat);
  chatToggle?.addEventListener('click', openChat);
  openHero?.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  backdrop.addEventListener('click', closeChat);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  function removeChips() {
    chips?.remove();
  }

  function appendMessage(role, text) {
    removeChips();
    const el = document.createElement('div');
    el.classList.add('message', `message--${role}`);
    el.textContent = text;
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
    input.disabled  = on;
    sendBtn.disabled = on;
  }

  // ── Core send ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    if (!isOpen) openChat();

    appendMessage('user', text);
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
      appendMessage('bot', data.result);
      conversation.push({ role: 'model', text: data.result });

    } catch (err) {
      console.error('[JogjaGuide]', err.message);
      thinkEl.remove();
      const msg = err instanceof TypeError
        ? 'Gagal terhubung. Cek koneksimu ya!'
        : `Maaf, ada masalah: ${err.message}`;
      const el = appendMessage('bot', msg);
      el.classList.add('message--error');
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

  // ── Quick chips ────────────────────────────────────────────────────────
  document.querySelectorAll('.chip, [data-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (!prompt) return;
      input.value = '';
      sendMessage(prompt);
    });
  });

  // ── Clear chat ─────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
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

    // Re-bind chip events
    chatBox.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        sendMessage(btn.dataset.prompt);
      });
    });

    input.focus();
  });

})();