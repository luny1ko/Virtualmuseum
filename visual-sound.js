// visual-sound.js
/**
 * МОДУЛЬ 5: ПРОЦЕДУРНЫЙ АУДИО-ДВИЖОК (Web Audio API, без внешних mp3)
 * И ТАКТИЛЬНАЯ ГАЛЕРЕЙНАЯ СРЕДА (Architectural Clay & Modern Gallery)
 *
 * Синтезирует в реальном времени:
 * - Шелест переворачиваемых архивных страниц (фильтрация розового/белого шума)
 * - Мягкий глухой щелчок переплёта книги-летописи
 * - Благородный приглушённый щелчок при клике по витринам и кнопкам меню
 * - Мягкий суб-басовый импульс при переходе между залами
 * - Управляет кнопкой Mute с сохранением в localStorage ('museum_sfx_muted')
 */

export class MuseumSoundEngine {
  constructor() {
    this.storageKey = 'museum_sfx_muted';
    this.isMuted = localStorage.getItem(this.storageKey) === 'true';
    this.ctx = null;
    this.noiseBuffer = null;
    this.lastClickTime = 0;

    this.mountMuteButton();
    this.bindGlobalInteractions();
  }

  initContext() {
    if (this.isMuted) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx && AudioCtx) {
      this.ctx = new AudioCtx();
      this.createArchivalNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Генерирует буфер мягкого бумажного шума для эффекта перелистывания страниц
   */
  createArchivalNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Фильтр Полла Келлетта для получения тёплого розового шума бумаги
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buffer;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem(this.storageKey, String(this.isMuted));
    this.updateMuteButtonUI();

    if (!this.isMuted) {
      this.initContext();
      this.playNobleClick();
    }
    return this.isMuted;
  }

  mountMuteButton() {
    const header = document.querySelector('.navigation-header');
    const liteBtn = document.getElementById('btn-toggle-lite');
    if (!header) return;

    let btn = document.getElementById('btn-toggle-sfx');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btn-toggle-sfx';
      btn.className = 'header-action-btn';
      btn.title = 'Звуковое сопровождение интерфейса (Mute / Unmute)';
      btn.innerHTML = `
        <svg class="header-btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path class="sfx-wave" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path class="sfx-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
        <span id="sfx-btn-text" class="header-btn-text">Звук</span>
      `;
      if (liteBtn && liteBtn.nextSibling) {
        header.insertBefore(btn, liteBtn.nextSibling);
      } else {
        header.appendChild(btn);
      }
    }

    btn.onclick = () => this.toggleMute();
    this.updateMuteButtonUI();
  }

  updateMuteButtonUI() {
    const btn = document.getElementById('btn-toggle-sfx');
    const label = document.getElementById('sfx-btn-text');
    if (!btn) return;

    btn.classList.toggle('active', !this.isMuted);
    btn.classList.toggle('sfx-muted', this.isMuted);
    if (label) {
      label.textContent = this.isMuted ? 'Без звука' : 'Звук';
    }
  }

  /**
   * 1. Шелест переворачиваемой архивной страницы в книге-прелоадере
   */
  playPageFlip() {
    const ctx = this.initContext();
    if (!ctx || !this.noiseBuffer) return;

    try {
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      // Полосовой фильтр, имитирующий скольжение плотной бумаги
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.exponentialRampToValueAtTime(1450, now + 0.16);
      filter.frequency.exponentialRampToValueAtTime(520, now + 0.34);
      filter.Q.setValueAtTime(1.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start(now);
      source.stop(now + 0.38);
    } catch (e) {}
  }

  /**
   * 2. Мягкий тактильный щелчок тяжёлой обложки книги
   */
  playBookCoverClick() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Низкий бархатный стук переплёта
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(118, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.17);

      // Тонкий латунный отзвук застёжки
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(528, now + 0.02);
      chime.frequency.exponentialRampToValueAtTime(880, now + 0.28);

      chimeGain.gain.setValueAtTime(0.001, now);
      chimeGain.gain.linearRampToValueAtTime(0.03, now + 0.04);
      chimeGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);

      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now + 0.02);
      chime.stop(now + 0.46);
    } catch (e) {}
  }

  /**
   * 3. Благородный приглушённый щелчок при клике по витринам и кнопкам меню
   */
  playNobleClick() {
    const nowMs = performance.now();
    if (nowMs - this.lastClickTime < 35) return;
    this.lastClickTime = nowMs;

    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.exponentialRampToValueAtTime(210, t + 0.026);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, t);

      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.03);
    } catch (e) {}
  }

  /**
   * 4. Мягкий суб-басовый импульс при переходе между залами
   */
  playSubBassPulse() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      // Глубокая архитектурная волна (76 Гц -> 29 Гц)
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(76, t);
      sub.frequency.exponentialRampToValueAtTime(29, t + 0.72);

      subGain.gain.setValueAtTime(0.001, t);
      subGain.gain.linearRampToValueAtTime(0.18, t + 0.06);
      subGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.78);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(t);
      sub.stop(t + 0.8);

      // Тёплый обертон зала
      const warm = ctx.createOscillator();
      const warmFilter = ctx.createBiquadFilter();
      const warmGain = ctx.createGain();

      warm.type = 'triangle';
      warm.frequency.setValueAtTime(196, t);
      warm.frequency.exponentialRampToValueAtTime(130.81, t + 0.6);

      warmFilter.type = 'lowpass';
      warmFilter.frequency.setValueAtTime(340, t);

      warmGain.gain.setValueAtTime(0.001, t);
      warmGain.gain.linearRampToValueAtTime(0.032, t + 0.08);
      warmGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.65);

      warm.connect(warmFilter);
      warmFilter.connect(warmGain);
      warmGain.connect(ctx.destination);
      warm.start(t);
      warm.stop(t + 0.68);
    } catch (e) {}
  }

  /**
   * 5. Мягкий камерный отклик для Викторины 2.0 (изумруд / терракот)
   */
  playQuizFeedback(isCorrect) {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const notes = isCorrect ? [440, 554.37, 659.25] : [246.94, 220];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isCorrect ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.065);

        gain.gain.setValueAtTime(0.055, t + idx * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + idx * 0.065 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + idx * 0.065);
        osc.stop(t + idx * 0.065 + 0.3);
      });
    } catch (e) {}
  }

  bindGlobalInteractions() {
    window.addEventListener('pointerdown', () => this.initContext(), { once: true, passive: true });

    const clickableSelectors = [
      '.nav-item-btn',
      '.header-action-btn',
      '.hotspot-marker',
      '.catalog-card',
      '.filter-chip',
      '.smart-tag-btn',
      '.view-seg-btn',
      '.quiz-option-btn',
      '.mode-btn',
      '.audioguide-btn',
      '.drawer-close-btn',
      '.map-close-btn',
      '.sheet-close-btn',
      '.quiz-close-btn'
    ].join(',');

    document.addEventListener('click', (e) => {
      const target = e.target.closest(clickableSelectors);
      if (target && target.id !== 'btn-toggle-sfx') {
        this.playNobleClick();
      }
    }, { passive: true });
  }
}

/* ==========================================================================
   ТАКТИЛЬНЫЙ 3D-TILT И СВЕТОВАЯ ГАММА ЗАЛОВ
   ========================================================================== */
export class ArchitecturalGalleryEnvironment {
  constructor() {
    this.hallLighting = {
      'college-history': { accent: '#c5a059', rgb: '197, 160, 89', warmTint: 'rgba(197, 160, 89, 0.16)' },
      'region-history':  { accent: '#7c9eb2', rgb: '124, 158, 178', warmTint: 'rgba(124, 158, 178, 0.16)' },
      'military-glory':  { accent: '#b85d4c', rgb: '184, 93, 76', warmTint: 'rgba(184, 93, 76, 0.18)' },
      'achievements':    { accent: '#9d8bb8', rgb: '157, 139, 184', warmTint: 'rgba(157, 139, 184, 0.16)' }
    };
  }

  applyHallLighting(hallId) {
    const preset = this.hallLighting[hallId] || this.hallLighting['college-history'];
    const root = document.documentElement;
    root.style.setProperty('--color-accent', preset.accent);
    root.style.setProperty('--color-accent-rgb', preset.rgb);
    root.style.setProperty('--ambient-shadow', preset.warmTint);
    document.body.setAttribute('data-active-hall', hallId);
  }

  /**
   * Подключает благородный 3D-Tilt эффект к карточкам Каталога 2.0
   */
  bindTiltCards(selector = '.catalog-card') {
    const cards = document.querySelectorAll(selector);
    cards.forEach((card) => {
      if (card.dataset.tiltBound === 'true') return;
      card.dataset.tiltBound = 'true';

      let sheen = card.querySelector('.clay-specular-sheen');
      if (!sheen) {
        sheen = document.createElement('div');
        sheen.className = 'clay-specular-sheen';
        card.appendChild(sheen);
      }

      card.addEventListener('pointermove', (e) => {
        if (document.body.classList.contains('lite-mode')) return;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;

        const rotY = (px - 0.5) * 10;
        const rotX = (0.5 - py) * 10;

        card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px)`;
        sheen.style.opacity = '1';
        sheen.style.background = `radial-gradient(circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(244, 239, 230, 0.22) 0%, rgba(197, 160, 89, 0.08) 40%, transparent 70%)`;
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
        sheen.style.opacity = '0';
      });
    });
  }
}

export let globalSoundEngine = null;
export let globalGalleryEnv = null;

export function initVisualAndSoundEngine(appInstance) {
  if (!globalSoundEngine) globalSoundEngine = new MuseumSoundEngine();
  if (!globalGalleryEnv) globalGalleryEnv = new ArchitecturalGalleryEnvironment();

  if (!appInstance) {
    return { soundEngine: globalSoundEngine, galleryEnv: globalGalleryEnv };
  }

  // Применяем палитру активного зала
  globalGalleryEnv.applyHallLighting(appInstance.currentHall?.id || 'college-history');

  // Перехватываем switchHall для мягкого суб-басового импульса и смены интерьерной подсветки
  const origSwitchHall = appInstance.switchHall.bind(appInstance);
  let initialLoad = !appInstance.currentHall;

  appInstance.switchHall = async function (hallId, targetVitrineId = null) {
    globalGalleryEnv.applyHallLighting(hallId);
    if (!initialLoad) {
      globalSoundEngine.playSubBassPulse();
    }
    initialLoad = false;
    return await origSwitchHall(hallId, targetVitrineId);
  };

  // Перехватываем openVitrineDrawer для тактильного отклика
  const origOpenDrawer = appInstance.openVitrineDrawer.bind(appInstance);
  appInstance.openVitrineDrawer = function (spot) {
    globalSoundEngine.playNobleClick();
    return origOpenDrawer(spot);
  };

  return { soundEngine: globalSoundEngine, galleryEnv: globalGalleryEnv };
}