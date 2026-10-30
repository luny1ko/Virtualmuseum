(() => {
  const stage = document.getElementById('exhibitStage');
  const img = document.getElementById('exhibitImage');
  const toggle = document.getElementById('exhibitTextToggle');
  const desc = document.getElementById('exhibitDescription');
  const close = document.getElementById('exhibitDescClose');
  if (!stage || !img) return;

  let scale = 1;
  let targetScale = 1;
  let x = 0, y = 0;
  let targetX = 0, targetY = 0;
  let dragging = false;
  let startX = 0, startY = 0;
  let pointerId = null;

  const MIN_SCALE = 1;
  const MAX_SCALE = 4.5;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function clampPosition() {
    const rect = stage.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * targetScale - rect.width) / 2 + 120);
    const maxY = Math.max(0, (rect.height * targetScale - rect.height) / 2 + 120);
    targetX = clamp(targetX, -maxX, maxX);
    targetY = clamp(targetY, -maxY, maxY);
    if (targetScale <= MIN_SCALE + 0.001) {
      targetX = 0;
      targetY = 0;
    }
  }

  function animate() {
    scale += (targetScale - scale) * 0.16;
    x += (targetX - x) * 0.16;
    y += (targetY - y) * 0.16;
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    requestAnimationFrame(animate);
  }
  animate();

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = targetScale;
    const step = e.deltaY < 0 ? 0.18 : -0.18;
    targetScale = clamp(targetScale + step, MIN_SCALE, MAX_SCALE);

    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const zoomFactor = targetScale / old;
    targetX = mx - (mx - targetX) * zoomFactor;
    targetY = my - (my - targetY) * zoomFactor;
    clampPosition();
  }, { passive: false });

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    stage.classList.add('is-grabbing');
    stage.setPointerCapture(pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    targetX += dx;
    targetY += dy;
    clampPosition();
  });

  function stopDrag(e) {
    if (!dragging) return;
    if (e && pointerId !== null && e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    stage.classList.remove('is-grabbing');
  }
  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);
  window.addEventListener('resize', clampPosition);

  function openDesc() {
    desc?.classList.add('is-open');
    desc?.setAttribute('aria-hidden', 'false');
  }
  function closeDesc() {
    desc?.classList.remove('is-open');
    desc?.setAttribute('aria-hidden', 'true');
  }

  toggle?.addEventListener('click', openDesc);
  close?.addEventListener('click', closeDesc);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDesc();
    if (e.key.toLowerCase() === 'i') openDesc();
  });
})();


// Отключает всплывающую панель браузера/поиска на изображениях.
(function disableImageToolbars(){
  function protectImage(img){
    if (!img) return;
    img.setAttribute('draggable', 'false');
    img.setAttribute('data-no-image-toolbar', 'true');
    img.setAttribute('data-disable-image-toolbar', 'true');
    img.setAttribute('galleryimg', 'no');
    img.addEventListener('dragstart', function(e){ e.preventDefault(); }, { passive: false });
  }

  function protectAll(){
    document.querySelectorAll('img').forEach(protectImage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', protectAll);
  } else {
    protectAll();
  }

  const observer = new MutationObserver(protectAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
