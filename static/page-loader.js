(() => {
  const MIN_SHOW = 280;
  const FAST_NAV_DELAY = 180;
  let overlay = null;
  let percentEl = null;
  let current = 0;
  let target = 98;
  let started = Date.now();
  let hideTimer = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'museum-loader is-visible';
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="museum-loader__percent">0%</div>';
    document.documentElement.classList.add('is-loading-page');
    document.body.appendChild(overlay);
    percentEl = overlay.querySelector('.museum-loader__percent');
    return overlay;
  }

  function setPercent(value) {
    current = Math.max(0, Math.min(100, Math.round(value)));
    if (percentEl) percentEl.textContent = current + '%';
  }

  function tick() {
    if (!overlay || !overlay.classList.contains('is-visible')) return;
    const diff = target - current;
    if (diff > 0) setPercent(current + Math.max(1, diff * 0.08));
    requestAnimationFrame(tick);
  }

  function show(start = 0) {
    ensureOverlay();
    clearTimeout(hideTimer);
    started = Date.now();
    target = 98;
    setPercent(start);
    overlay.classList.add('is-visible');
    document.documentElement.classList.add('is-loading-page');
    requestAnimationFrame(tick);
  }

  function complete() {
    ensureOverlay();
    target = 100;
    setPercent(100);
    const wait = Math.max(90, MIN_SHOW - (Date.now() - started));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      overlay.classList.remove('is-visible');
      document.documentElement.classList.remove('is-loading-page');
    }, wait);
  }

  function navigate(url) {
    if (!url) return;
    show(0);
    setTimeout(() => { window.location.href = url; }, FAST_NAV_DELAY);
  }

  window.MuseumLoader = { show, complete, navigate };

  document.addEventListener('DOMContentLoaded', () => {
    ensureOverlay();
    requestAnimationFrame(tick);

    document.querySelectorAll('img').forEach(img => {
      img.draggable = false;
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', e => e.preventDefault());
    });

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(link.href);
    }, true);
  });

  window.addEventListener('load', () => {
    setTimeout(complete, 120);
  });
})();
