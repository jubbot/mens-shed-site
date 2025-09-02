(() => {
  const DEFAULT_REMOVE_MS = 600;

  const toMs = (s) => (s.endsWith('ms') ? parseFloat(s) : parseFloat(s) * 1000);

  function getTransitionMs(node) {
    const cs = getComputedStyle(node);
    const durs = (cs.transitionDuration || '0s').split(',').map((x) => x.trim());
    const delays = (cs.transitionDelay || '0s').split(',').map((x) => x.trim());
    const total = durs
      .map((d, i) => (Number.isFinite(toMs(d)) ? toMs(d) : 0) + (delays[i] ? toMs(delays[i]) : 0))
      .filter((n) => Number.isFinite(n));
    return total.length ? Math.max(...total) : DEFAULT_REMOVE_MS;
  }

  function removeWithFade(node) {
    node.classList.add('fade-out');
    setTimeout(() => node.remove(), getTransitionMs(node));
  }

  function wireFlash(node) {
    if (!node || node.__wired) return;
    node.__wired = true;

    const closeBtn = node.querySelector('.flash-close');
    const remove = () => removeWithFade(node);

    closeBtn && closeBtn.addEventListener('click', remove);

    // Auto-dismiss
    const ms = Number(node.getAttribute('data-dismiss'));
    if (Number.isFinite(ms) && ms > 0) node.__timer = setTimeout(remove, ms);

    // ESC to dismiss (one-shot)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        remove();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey, { once: true });
  }

  function initExisting() {
    document.querySelectorAll('.flash').forEach(wireFlash);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function show({ message, type = 'info', timeout = 4000, mount } = {}) {
    const container =
      mount ||
      document.getElementById('flash-root') ||
      document.querySelector('.site-main, main') ||
      document.body;

    const el = document.createElement('div');
    el.className = `flash flash-${type}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    if (timeout) el.setAttribute('data-dismiss', String(timeout));
    el.innerHTML = `
      <span class="flash-text">${escapeHtml(message)}</span>
      <button class="flash-close" type="button" aria-label="Close">&times;</button>
    `;

    container.prepend(el);
    wireFlash(el);
    return el;
  }

  function clear() {
    document.querySelectorAll('.flash').forEach((n) => n.remove());
  }

  // Expose globally for page scripts / AJAX
  window.flash = { show, clear };

  // Wire server-rendered flashes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExisting);
  } else {
    initExisting();
  }

  // Auto-wire flashes added later (AJAX/navigation)
  const obs = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.classList.contains('flash')) wireFlash(n);
      });
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
