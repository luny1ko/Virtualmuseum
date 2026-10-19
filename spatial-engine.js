// spatial-engine.js
/**
 * Пространственный и тактильный движок «Виртуального музея ЛДПК»
 * 1. DynamicThemeEngine — 60 FPS интерполяция цветовой ДНК залов за 0.8с.
 * 2. HoloTiltEngine — физический 3D Tilt и голографический блик (Specular Sheen) с lerp-инерцией.
 * 3. IsometricBlueprintEngine — изометрический 3D-план здания с объемными стенами и маяками.
 * 4. HapticAudioEngine — процедурный синтезатор тактильных звуков интерфейса на Web Audio API.
 */

/* ==========================================================================
   1. ДИНАМИЧЕСКИЙ АМБИЕНТ И АТМОСФЕРА ЗАЛОВ (DYNAMIC THEME ENGINE)
   ========================================================================== */
export class DynamicThemeEngine {
  constructor() {
    // Световая ДНК каждого зала из exhibits.json
    this.palettes = {
      'college-history': {
        primary: [217, 119, 6],   // #d97706 — глубокий янтарный винтаж
        accent: [251, 191, 36],   // #fbbf24 — теплое золото
        shadowAlpha: 0.32
      },
      'region-history': {
        primary: [2, 132, 199],   // #0284c7 — фарфоровый лазурный индиго
        accent: [56, 189, 248],   // #38bdf8 — чистый циан
        shadowAlpha: 0.28
      },
      'military-glory': {
        primary: [220, 38, 38],   // #dc2626 — мемориальный рубиновый
        accent: [248, 113, 113],  // #f87171 — стальной багрянец
        shadowAlpha: 0.35
      },
      'achievements': {
        primary: [124, 58, 237],  // #7c3aed — кибер-фиолетовый
        accent: [192, 132, 252],  // #c084fc — неоновый аметист
        shadowAlpha: 0.32
      }
    };

    this.currentState = {
      primary: [...this.palettes['college-history'].primary],
      accent: [...this.palettes['college-history'].accent],
      shadowAlpha: 0.32
    };

    this.rafId = null;
    this.duration = 800; // 0.8с плавная интерполяция
  }

  transitionToHall(hallId) {
    const target = this.palettes[hallId] || this.palettes['college-history'];
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const startPrimary = [...this.currentState.primary];
    const startAccent = [...this.currentState.accent];
    const startAlpha = this.currentState.shadowAlpha;
    const startTime = performance.now();

    // Плавная кривая замедления (easeOutCubic)
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / this.duration);
      const eased = easeOutCubic(progress);

      this.currentState.primary = startPrimary.map((c, i) =>
        Math.round(c + (target.primary[i] - c) * eased)
      );
      this.currentState.accent = startAccent.map((c, i) =>
        Math.round(c + (target.accent[i] - c) * eased)
      );
      this.currentState.shadowAlpha =
        startAlpha + (target.shadowAlpha - startAlpha) * eased;

      this.applyCSSVariables(hallId);

      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      }
    };

    this.rafId = requestAnimationFrame(step);
  }

  applyCSSVariables(hallId) {
    const root = document.documentElement;
    const [pr, pg, pb] = this.currentState.primary;
    const [ar, ag, ab] = this.currentState.accent;
    const sa = this.currentState.shadowAlpha.toFixed(3);

    const primaryHex = `rgb(${pr}, ${pg}, ${pb})`;
    const accentHex = `rgb(${ar}, ${ag}, ${ab})`;

    // Новые переменные световой ДНК
    root.style.setProperty('--hall-primary', primaryHex);
    root.style.setProperty('--hall-primary-rgb', `${pr}, ${pg}, ${pb}`);
    root.style.setProperty('--accent-glow', `rgba(${ar}, ${ag}, ${ab}, 0.45)`);
    root.style.setProperty('--ambient-shadow', `rgba(${pr}, ${pg}, ${pb}, ${sa})`);

    // Бесшовная перезапись базовых переменных styles.css
    root.style.setProperty('--color-accent', accentHex);
    root.style.setProperty('--color-accent-rgb', `${ar}, ${ag}, ${ab}`);

    document.body.setAttribute('data-active-hall', hallId);
  }
}

/* ==========================================================================
   2. ФИЗИЧЕСКИЙ 3D TILT И ИНТЕРАКТИВНЫЙ ГОЛОГРАФИЧЕСКИЙ ГЛЯНЕЦ
   ========================================================================== */
export class HoloTiltEngine {
  constructor() {
    this.trackedElements = new Map();
    this.rafId = null;
    this.isRunning = false;
    this.init();
  }

  init() {
    this.bindGlobalDelegation();
    this.startLoop();
  }

  /**
   * Регистрирует DOM-элемент для 3D-наклона и голографического блика
   */
  attachToElement(el, config = {}) {
    if (!el || this.trackedElements.has(el)) return;

    const maxTilt = config.maxTilt || 7;
    const perspective = config.perspective || 1100;
    const scale = config.scale || 1.015;
    const lerpFactor = config.lerp || 0.12;

    el.classList.add('holo-tilt-surface');

    // Создаем слой скользящего блика (specular sheen), если его еще нет
    let sheen = el.querySelector(':scope > .holo-specular-sheen');
    if (!sheen) {
      sheen = document.createElement('div');
      sheen.className = 'holo-specular-sheen';
      sheen.setAttribute('aria-hidden', 'true');
      el.appendChild(sheen);
    }

    const state = {
      el,
      sheen,
      maxTilt,
      perspective,
      scale,
      lerpFactor,
      isHovered: false,
      targetRx: 0,
      targetRy: 0,
      currentRx: 0,
      currentRy: 0,
      targetSheenX: 50,
      targetSheenY: 50,
      currentSheenX: 50,
      currentSheenY: 50,
      targetOpacity: 0,
      currentOpacity: 0
    };

    el.addEventListener('pointer move', (e) => this.handlePointerMove(e, state));
    el.addEventListener('mousemove', (e) => this.handlePointerMove(e, state), { passive: true });
    el.addEventListener('mouseenter', () => {
      if (document.body.classList.contains('lite-mode')) return;
      state.isHovered = true;
      state.targetOpacity = 1;
      this.startLoop();
    }, { passive: true });
    el.addEventListener('mouseleave', () => {
      state.isHovered = false;
      state.targetRx = 0;
      state.targetRy = 0;
      state.targetOpacity = 0;
      this.startLoop();
    }, { passive: true });

    this.trackedElements.set(el, state);
  }

  handlePointerMove(e, state) {
    if (document.body.classList.contains('lite-mode')) return;

    const rect = state.el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const clampedX = Math.max(0, Math.min(1, relX));
    const clampedY = Math.max(0, Math.min(1, relY));

    // Отклонение в 3D: курсор выше центра -> наклон от себя, правее -> вправо
    state.targetRy = (clampedX - 0.5) * 2 * state.maxTilt;
    state.targetRx = (0.5 - clampedY) * 2 * state.maxTilt;

    state.targetSheenX = clampedX * 100;
    state.targetSheenY = clampedY * 100;
    state.targetOpacity = 1;

    this.startLoop();
  }

  bindGlobalDelegation() {
    // Привязываем к основным панелям музея
    const mapContainer = document.querySelector('.map-modal-container');
    if (mapContainer) {
      this.attachToElement(mapContainer, { maxTilt: 2.2, perspective: 1400, scale: 1.0, lerp: 0.1 });
    }

    const drawerMediaBox = document.querySelector('.drawer-media-box');
    if (drawerMediaBox) {
      this.attachToElement(drawerMediaBox, { maxTilt: 4.5, perspective: 900, scale: 1.01, lerp: 0.14 });
    }

    const quizContainer = document.querySelector('.quiz-modal-container');
    if (quizContainer) {
      this.attachToElement(quizContainer, { maxTilt: 3.0, perspective: 1200, scale: 1.0, lerp: 0.12 });
    }
  }

  refreshCatalogCards() {
    const cards = document.querySelectorAll('.catalog-card');
    cards.forEach((card) => {
      this.attachToElement(card, { maxTilt: 8.5, perspective: 950, scale: 1.02, lerp: 0.14 });
    });
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  tick() {
    if (document.body.classList.contains('lite-mode')) {
      this.resetAllTransforms();
      this.isRunning = false;
      return;
    }

    let hasActiveMotion = false;

    this.trackedElements.forEach((s) => {
      // Инерционная интерполяция (lerp easing)
      s.currentRx += (s.targetRx - s.currentRx) * s.lerpFactor;
      s.currentRy += (s.targetRy - s.currentRy) * s.lerpFactor;
      s.currentSheenX += (s.targetSheenX - s.currentSheenX) * (s.lerpFactor * 1.2);
      s.currentSheenY += (s.targetSheenY - s.currentSheenY) * (s.lerpFactor * 1.2);
      s.currentOpacity += (s.targetOpacity - s.currentOpacity) * 0.1;

      const isMoving =
        Math.abs(s.targetRx - s.currentRx) > 0.015 ||
        Math.abs(s.targetRy - s.currentRy) > 0.015 ||
        Math.abs(s.targetOpacity - s.currentOpacity) > 0.01;

      if (isMoving || s.isHovered) {
        hasActiveMotion = true;
        const currentScale = s.isHovered ? s.scale : 1 + (s.scale - 1) * s.currentOpacity;

        s.el.style.transform = `perspective(${s.perspective}px) rotateX(${s.currentRx.toFixed(2)}deg) rotateY(${s.currentRy.toFixed(2)}deg) scale3d(${currentScale.toFixed(3)}, ${currentScale.toFixed(3)}, 1)`;

        if (s.sheen) {
          s.sheen.style.opacity = s.currentOpacity.toFixed(3);
          s.sheen.style.background = `radial-gradient(circle at ${s.currentSheenX.toFixed(1)}% ${s.currentSheenY.toFixed(1)}%, rgba(255, 255, 255, 0.22) 0%, rgba(var(--color-accent-rgb), 0.14) 32%, transparent 68%)`;
        }
      } else if (Math.abs(s.currentRx) > 0.001 || Math.abs(s.currentRy) > 0.001) {
        s.currentRx = 0;
        s.currentRy = 0;
        s.currentOpacity = 0;
        s.el.style.transform = '';
        if (s.sheen) s.sheen.style.opacity = '0';
      }
    });

    if (hasActiveMotion) {
      this.rafId = requestAnimationFrame(() => this.tick());
    } else {
      this.isRunning = false;
    }
  }

  resetAllTransforms() {
    this.trackedElements.forEach((s) => {
      s.el.style.transform = '';
      if (s.sheen) s.sheen.style.opacity = '0';
    });
  }
}

/* ==========================================================================
   3. ИЗОМЕТРИЧЕСКИЙ 3D АРХИТЕКТУРНЫЙ ПЛАН ЗДАНИЯ (ISOMETRIC SPATIAL BLUEPRINT)
   ========================================================================== */
export class IsometricBlueprintEngine {
  constructor() {
    this.svg = document.getElementById('museum-svg-map');
    this.wrapper = document.querySelector('.map-canvas-wrapper');
    this.isIsometric = true;

    //Вектор изометрической экструзии (высота стен в проекции SVG)
    this.extrudeDX = -12;
    this.extrudeDY = -18;

    this.roomConfigs = [
      { id: 'college-history', x: 20, y: 20, w: 380, h: 230 },
      { id: 'achievements',    x: 20, y: 260, w: 155, h: 520 },
      { id: 'region-history',  x: 185, y: 260, w: 215, h: 280 },
      { id: 'military-glory',  x: 185, y: 550, w: 215, h: 230 }
    ];

    this.init();
  }

  init() {
    if (!this.svg || !this.wrapper) return;
    this.wrapper.classList.add('iso-blueprint-stage', 'iso-active');
    this.injectViewToggleBtn();
    this.buildExtrudedRoomVolumes();
    this.bindStageParallax();
  }

  /**
   * Добавляет кнопку переключения 3D Изометрия / 2D План в шапку модального окна карты
   */
  injectViewToggleBtn() {
    const tools = document.querySelector('.map-header-tools');
    if (!tools || document.getElementById('btn-toggle-iso-view')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-toggle-iso-view';
    btn.className = 'btn-map-tool active';
    btn.textContent = '🧊 3D Изометрия';
    btn.title = 'Переключить между изометрической 3D-проекцией и плоским чертежом';

    btn.addEventListener('click', () => {
      this.isIsometric = !this.isIsometric;
      this.wrapper.classList.toggle('iso-active', this.isIsometric);
      btn.classList.toggle('active', this.isIsometric);
      btn.textContent = this.isIsometric ? '🧊 3D Изометрия' : '📐 2D Чертеж';
      if (!this.isIsometric) {
        this.svg.style.transform = '';
      }
    });

    tools.insertBefore(btn, tools.firstChild);
  }

  /**
   * Создает псевдо-объемные 3D-стены, стеклянный пол и неоновый контур крыши для каждой комнаты
   */
  buildExtrudedRoomVolumes() {
    const dx = this.extrudeDX;
    const dy = this.extrudeDY;

    this.roomConfigs.forEach((r) => {
      const group = document.getElementById(`map-hall-${r.id}`);
      const basePoly = group?.querySelector('.hall-polygon');
      if (!group || !basePoly || group.querySelector('.iso-walls-group')) return;

      const wallsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wallsGroup.setAttribute('class', 'iso-walls-group');

      // Левая/верхняя и правая/нижняя 3D-грани стен (экструзия вверх по вектору dx, dy)
      const x1 = r.x, y1 = r.y;
      const x2 = r.x + r.w, y2 = r.y + r.h;

      // Южная (нижняя) объемная стена
      const southWall = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      southWall.setAttribute(
        'points',
        `${x1},${y2} ${x2},${y2} ${x2 + dx},${y2 + dy} ${x1 + dx},${y2 + dy}`
      );
      southWall.setAttribute('class', 'iso-wall-south');

      // Восточная (правая) объемная стена
      const eastWall = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      eastWall.setAttribute(
        'points',
        `${x2},${y1} ${x2},${y2} ${x2 + dx},${y2 + dy} ${x2 + dx},${y1 + dy}`
      );
      eastWall.setAttribute('class', 'iso-wall-east');

      // Верхний парящий контур стен (крыша/периметр на высоте экструзии)
      const roofRim = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      roofRim.setAttribute('x', x1 + dx);
      roofRim.setAttribute('y', y1 + dy);
      roofRim.setAttribute('width', r.w);
      roofRim.setAttribute('height', r.h);
      roofRim.setAttribute('rx', '8');
      roofRim.setAttribute('class', 'iso-roof-rim');

      wallsGroup.appendChild(southWall);
      wallsGroup.appendChild(eastWall);
      wallsGroup.appendChild(roofRim);

      // Вставляем объемные стены сразу после базового стеклянного пола
      basePoly.insertAdjacentElement('afterend', wallsGroup);
    });
  }

  /**
   * Мягкое вращение изометрической сцены за курсором мыши
   */
  bindStageParallax() {
    this.wrapper.addEventListener('mousemove', (e) => {
      if (!this.isIsometric || document.body.classList.contains('lite-mode')) return;
      const rect = this.wrapper.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      const rotX = 52 - ny * 6;
      const rotZ = -28 + nx * 8;
      this.svg.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(0.92)`;
    }, { passive: true });

    this.wrapper.addEventListener('mouseleave', () => {
      if (!this.isIsometric) return;
      this.svg.style.transform = '';
    }, { passive: true });
  }

  /**
   * Модернизирует узлы витрин на карте в парящие 3D-маяки с вертикальными лучами и волнами
   */
  upgradeVitrineBeacons() {
    if (!this.svg) return;
    const nodes = this.svg.querySelectorAll('.map-vitrine-node');
    const dx = this.extrudeDX * 1.15;
    const dy = this.extrudeDY * 1.35;

    nodes.forEach((node) => {
      if (node.classList.contains('iso-upgraded')) return;
      node.classList.add('iso-upgraded');

      const circle = node.querySelector('.vitrine-node-circle');
      const idxText = node.querySelector('.vitrine-node-idx');
      const titleText = node.querySelector('.vitrine-node-title');

      // 1. Волновой импульс на полу (Sonar Ring)
      const pulseRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pulseRing.setAttribute('r', '11');
      pulseRing.setAttribute('class', 'iso-vitrine-wave');
      node.insertBefore(pulseRing, circle);

      // 2. Вертикальный голографический луч от пола к парящему маяку
      const beamLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      beamLine.setAttribute('x1', '0');
      beamLine.setAttribute('y1', '0');
      beamLine.setAttribute('x2', dx.toFixed(1));
      beamLine.setAttribute('y2', dy.toFixed(1));
      beamLine.setAttribute('class', 'iso-vitrine-stem');
      node.appendChild(beamLine);

      // 3. Парящая 3D-капсула маяка над полом
      const capGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      capGroup.setAttribute('class', 'iso-vitrine-cap');
      capGroup.setAttribute('transform', `translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`);

      const capCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      capCircle.setAttribute('r', '11');
      capCircle.setAttribute('class', 'vitrine-node-circle iso-cap-circle');
      capGroup.appendChild(capCircle);

      if (idxText) {
        capGroup.appendChild(idxText);
      }
      if (titleText) {
        titleText.setAttribute('y', '-16');
        capGroup.appendChild(titleText);
      }

      node.appendChild(capGroup);
    });
  }
}

/* ==========================================================================
   4. ПРОЦЕДУРНЫЙ АУДИО-ДВИЖОК ТАКТИЛЬНОСТИ (HAPTIC WEB AUDIO SYNTHESIZER)
   ========================================================================== */
export class HapticAudioEngine {
  constructor() {
    this.storageKey = 'museum_sfx_muted';
    this.isMuted = localStorage.getItem(this.storageKey) === 'true';
    this.ctx = null;
    this.lastHoverTime = 0;

    this.injectHeaderMuteButton();
    this.bindInteractiveTriggers();
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem(this.storageKey, this.isMuted.toString());
    this.updateMuteButtonUI();
    if (!this.isMuted) {
      this.initContext();
      this.playHoverRelay(true);
    }
  }

  injectHeaderMuteButton() {
    const header = document.querySelector('.navigation-header');
    const liteBtn = document.getElementById('btn-toggle-lite');
    if (!header || document.getElementById('btn-toggle-sfx')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-toggle-sfx';
    btn.className = 'header-action-btn';
    btn.title = 'Переключить тактильные звуки интерфейса (Web Audio SFX)';

    btn.innerHTML = `
      <svg class="header-btn-svg" id="sfx-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path class="sfx-wave" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path class="sfx-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
      <span id="sfx-btn-text" class="header-btn-text">SFX</span>
    `;

    btn.addEventListener('click', () => this.toggleMute());

    if (liteBtn && liteBtn.nextSibling) {
      header.insertBefore(btn, liteBtn.nextSibling);
    } else {
      header.appendChild(btn);
    }

    this.updateMuteButtonUI();
  }

  updateMuteButtonUI() {
    const btn = document.getElementById('btn-toggle-sfx');
    const text = document.getElementById('sfx-btn-text');
    if (!btn) return;

    btn.classList.toggle('active', !this.isMuted);
    btn.classList.toggle('sfx-muted', this.isMuted);
    if (text) {
      text.textContent = this.isMuted ? 'Mute' : 'SFX';
    }
  }

  /**
   * 1. Мягкий щелчок микро-реле при наведении на интерактивные элементы
   */
  playHoverRelay(force = false) {
    if (this.isMuted) return;
    const nowMs = performance.now();
    if (!force && nowMs - this.lastHoverTime < 45) return; // Защита от дребезга
    this.lastHoverTime = nowMs;

    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, t);
      osc.frequency.exponentialRampToValueAtTime(620, t + 0.016);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(500, t);

      gain.gain.setValueAtTime(0.032, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.018);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.02);
    } catch (e) {}
  }

  /**
   * 2. Глубокий суб-басовый пространственный импульс при переходе между залами
   */
  playHallTransitionSub() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;

      // Суб-басовое ядро (92 Гц -> 28 Гц)
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(92, t);
      sub.frequency.exponentialRampToValueAtTime(28, t + 0.78);

      subGain.gain.setValueAtTime(0.001, t);
      subGain.gain.linearRampToValueAtTime(0.22, t + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.85);

      sub.connect(subGain);
      subGain.connect(this.ctx.destination);
      sub.start(t);
      sub.stop(t + 0.88);

      // Мягкий атмосферный обертон
      const shimmer = this.ctx.createOscillator();
      const shimmerFilter = this.ctx.createBiquadFilter();
      const shimmerGain = this.ctx.createGain();

      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(220, t);
      shimmer.frequency.exponentialRampToValueAtTime(110, t + 0.65);

      shimmerFilter.type = 'lowpass';
      shimmerFilter.frequency.setValueAtTime(420, t);

      shimmerGain.gain.setValueAtTime(0.001, t);
      shimmerGain.gain.linearRampToValueAtTime(0.04, t + 0.08);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.7);

      shimmer.connect(shimmerFilter);
      shimmerFilter.connect(shimmerGain);
      shimmerGain.connect(this.ctx.destination);

      shimmer.start(t);
      shimmer.stop(t + 0.72);
    } catch (e) {}
  }

  /**
   * 3. Технологичный звук раскрытия архивного досье витрины
   */
  playDossierOpen() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const freqs = [523.25, 783.99, 1046.5]; // C5 -> G5 -> C6 голографический аккорд

      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = t + idx * 0.038;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * 0.85, start);
        osc.frequency.exponentialRampToValueAtTime(f, start + 0.06);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.042, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch (e) {}
  }

  bindInteractiveTriggers() {
    // Разблокировка AudioContext при первом клике в документе
    window.addEventListener('pointerdown', () => this.initContext(), { once: true, passive: true });

    // Делегирование события наведения на все кнопки меню, витрины и карточки
    const hoverSelectors = [
      '.nav-item-btn',
      '.header-action-btn',
      '.hotspot-marker',
      '.catalog-card',
      '.filter-chip',
      '.quiz-option-btn',
      '.map-hall-group',
      '.map-vitrine-node',
      '.mode-btn',
      '.audioguide-btn'
    ].join(',');

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest(hoverSelectors);
      if (target && !target.contains(e.relatedTarget)) {
        this.playHoverRelay();
      }
    }, { passive: true });
  }
}

/* ==========================================================================
   5. АВТОМАТИЧЕСКИЙ ИНТЕГРАТОР С КЛАССОМ MUSEUMAPP (APP.JS)
   ========================================================================== */
export function initSpatialEngine(appInstance) {
  const themeEngine = new DynamicThemeEngine();
  const tiltEngine = new HoloTiltEngine();
  const isoBlueprint = new IsometricBlueprintEngine();
  const hapticAudio = new HapticAudioEngine();

  if (!appInstance) {
    return { themeEngine, tiltEngine, isoBlueprint, hapticAudio };
  }

  // Если первый зал уже загружен синхронно из кэша — сразу применяем тему и 3D-маяки
  if (appInstance.currentHall?.id) {
    themeEngine.transitionToHall(appInstance.currentHall.id);
    isoBlueprint.upgradeVitrineBeacons();
  } else {
    themeEngine.transitionToHall('college-history');
  }

  // 1. Перехват переключения залов: динамическая световая ДНК + суб-басовый импульс
  const origSwitchHall = appInstance.switchHall.bind(appInstance);
  let isFirstHallLoad = !appInstance.currentHall;

  appInstance.switchHall = async function (hallId, targetVitrineId = null) {
    themeEngine.transitionToHall(hallId);
    if (!isFirstHallLoad) {
      hapticAudio.playHallTransitionSub();
    }
    isFirstHallLoad = false;
    return await origSwitchHall(hallId, targetVitrineId);
  };

  // 2. Перехват открытия досье витрины: звук раскрытия архива
  const origOpenVitrineDrawer = appInstance.openVitrineDrawer.bind(appInstance);
  appInstance.openVitrineDrawer = function (spot) {
    hapticAudio.playDossierOpen();
    return origOpenVitrineDrawer(spot);
  };

  // 3. Перехват рендера узлов карты: апгрейд витрин в парящие 3D-маяки
  const origRenderMapNodes = appInstance.renderMapVitrineNodes.bind(appInstance);
  appInstance.renderMapVitrineNodes = function () {
    origRenderMapNodes();
    isoBlueprint.upgradeVitrineBeacons();
  };

  // 4. Перехват рендера каталога: подключение 3D Tilt и блика к новым карточкам
  const origRenderCatalog = appInstance.renderCatalogItems.bind(appInstance);
  appInstance.renderCatalogItems = function () {
    origRenderCatalog();
    tiltEngine.refreshCatalogCards();
  };

  // 5. Звуковое сопровождение открытия Карты, Каталога и Викторины
  ['openMap', 'openCatalog', 'openQuiz'].forEach((methodName) => {
    if (typeof appInstance[methodName] === 'function') {
      const origMethod = appInstance[methodName].bind(appInstance);
      appInstance[methodName] = function (...args) {
        hapticAudio.playDossierOpen();
        return origMethod(...args);
      };
    }
  });

  return { themeEngine, tiltEngine, isoBlueprint, hapticAudio };
}