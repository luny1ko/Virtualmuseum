// vfx-engine.js
/**
 * VFX-ядро Виртуального музея ЛДПК (1941–2026)
 * 1. ChronoAudioSynth — процедурный синтез звука на чистом Web Audio API (без внешних mp3).
 * 2. TimeVaultPreloader — кинематографичный HUD-прелоадер со шторками (Letterbox Split).
 * 3. AmbientDustStage — интерактивный Canvas 2D слой музейной пыли в лучах света.
 */

/* ==========================================================================
   1. ПРОЦЕДУРНЫЙ СИНТЕЗАТОР ЗВУКА (WEB AUDIO API)
   ========================================================================== */
class ChronoAudioSynth {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.humNodes = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopProjectorHum();
    } else {
      this.initContext();
      this.startProjectorHum();
    }
    return this.isMuted;
  }

  /**
   * Мягкий научно-фантастический гул включения архивного проектора
   */
  startProjectorHum() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || this.humNodes) return;

    try {
      const now = this.ctx.currentTime;

      // Осциллятор 1: низкий аналоговый дрон (55 Гц, нота Ля субконтроктавы)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now);

      // Осциллятор 2: мягкая гармоника (110 Гц)
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(110, now);

      // LFO для медленного «дыхания» фильтра
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.4, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(35, now);

      // Низкочастотный фильтр для теплого лампового тембра
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.Q.setValueAtTime(3, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.045, now + 0.8);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      this.humNodes = { osc1, osc2, lfo, masterGain };
    } catch (e) {
      // Игнорируем блокировку автовоспроизведения браузером до первого клика
    }
  }

  stopProjectorHum() {
    if (!this.humNodes || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.humNodes.masterGain.gain.setValueAtTime(this.humNodes.masterGain.gain.value, now);
      this.humNodes.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      const nodes = this.humNodes;
      this.humNodes = null;
      setTimeout(() => {
        try {
          nodes.osc1.stop();
          nodes.osc2.stop();
          nodes.lfo.stop();
        } catch (err) {}
      }, 380);
    } catch (e) {
      this.humNodes = null;
    }
  }

  /**
   * Щелчок хронографа при смене года (высота тона плавно растет к 2026 году)
   */
  playChronoTick(progressRatio = 0) {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      // Частота растет от 900 Гц (1941) до 2100 Гц (2026)
      const baseFreq = 900 + progressRatio * 1200;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.028);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq, now);
      filter.Q.setValueAtTime(2.5, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }

  /**
   * Финальный кинематографичный суб-басовый «БУМ» и пневматический шелест шторок
   */
  playSubBassBoom() {
    this.stopProjectorHum();
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Суб-басовый удар (120 Гц -> 26 Гц)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(125, now);
      subOsc.frequency.exponentialRampToValueAtTime(26, now + 1.35);

      subGain.gain.setValueAtTime(0.32, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.5);

      // 2. Кристальный аккорд открытия (Cyan/Gold Shimmer)
      [440, 659.25, 880].forEach((freq, idx) => {
        const chime = this.ctx.createOscillator();
        const chimeGain = this.ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(freq, now + idx * 0.04);

        chimeGain.gain.setValueAtTime(0.001, now);
        chimeGain.gain.linearRampToValueAtTime(0.035, now + 0.08 + idx * 0.04);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

        chime.connect(chimeGain);
        chimeGain.connect(this.ctx.destination);
        chime.start(now);
        chime.stop(now + 1.65);
      });
    } catch (e) {}
  }
}

/* ==========================================================================
   2. КИНОШНЫЙ ИНТРО-ПРЕЛОАДЕР ВРЕМЕНИ (TIME-VAULT PRELOADER)
   ========================================================================== */
export class TimeVaultPreloader {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'ldpk_vault_intro_seen';
    this.startYear = 1941;
    this.endYear = 2026;
    this.durationMs = options.durationMs || 3800;

    this.synth = new ChronoAudioSynth();
    this.isActive = false;
    this.isClosing = false;
    this.rafId = null;
    this.lastTickYear = this.startYear;

    // Исторические вехи ЛДПК для бегущей телеметрии
    this.milestones = [
      { year: 1941, code: 'ARCHIVE_INIT // ДКТ', label: 'Открытие Дулёвского керамического техникума (ДКТ)' },
      { year: 1955, code: 'IND_SECTOR // ВМТ', label: 'Вечерний машиностроительный техникум и первые выпуски' },
      { year: 1967, code: 'MERGE_SYNC // ЛиДИТ', label: 'Слияние в Ликино-Дулёвский индустриальный техникум' },
      { year: 1970, code: 'AUTO_CADRE // ЛиДАМТ', label: 'ЛиДАМТ — кузница инженеров для завода ЛиАЗ' },
      { year: 1983, code: 'CAMPUS_BUILD // КОРПУС', label: 'Возведение нового лабораторного и учебного комплекса' },
      { year: 2015, code: 'GGTU_BRANCH // ЛДПК', label: 'Ликино-Дулёвский политехнический колледж — филиал ГГТУ' },
      { year: 2022, code: 'CLUSTER_PRO // РФ', label: 'Федеральный проект «Профессионалитет» и цифровые мастерские' },
      { year: 2026, code: 'EXPOSITION // ONLINE', label: 'Синхронизация цифрового фонда музея завершена (100%)' }
    ];

    this.init();
  }

  init() {
    // Если в текущей сессии интро уже просмотрено — не блокируем вход
    if (sessionStorage.getItem(this.storageKey) === 'true') {
      return;
    }
    this.mountDOM();
    this.startSequence();
  }

  /**
   * Позволяет принудительно перезапустить интро (например, по клику на логотип)
   */
  replay() {
    if (this.isActive) return;
    sessionStorage.removeItem(this.storageKey);
    this.lastTickYear = this.startYear;
    this.isClosing = false;
    this.mountDOM();
    this.startSequence();
  }

  mountDOM() {
    const existing = document.getElementById('time-vault-preloader');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'time-vault-preloader';
    wrapper.className = 'vault-preloader';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-label', 'Загрузка исторической хроники музея ЛДПК');

    wrapper.innerHTML = `
      <!-- Верхняя и нижняя кинематографичные шторки (Letterbox Shutters) -->
      <div class="vault-shutter vault-shutter-top">
        <div class="vault-grid-overlay"></div>
      </div>
      <div class="vault-shutter vault-shutter-bottom">
        <div class="vault-grid-overlay"></div>
      </div>

      <!-- Световая линия разреза шторок (Iris Split Seam) -->
      <div class="vault-laser-seam" id="vault-laser-seam"></div>

      <!-- Центральный футуристичный HUD -->
      <div class="vault-hud-card" id="vault-hud-card">
        <span class="hud-corner tl"></span>
        <span class="hud-corner tr"></span>
        <span class="hud-corner bl"></span>
        <span class="hud-corner br"></span>

        <!-- Верхняя планка телеметрии и координат -->
        <div class="vault-hud-topbar">
          <div class="vault-coords">
            <span class="coords-dot"></span>
            <span>55°42′25″ N &nbsp;38°57′19″ E // ЛИКИНО-ДУЛЁВО</span>
          </div>
          <button type="button" id="vault-sound-btn" class="vault-sound-btn" title="Звуковые эффекты хронографа">
            <span id="vault-sound-icon">🔊</span>
            <span id="vault-sound-label">SFX: ON</span>
          </button>
        </div>

        <!-- Бегущая строка системного статуса -->
        <div class="vault-data-stream">
          <span class="stream-tag" id="vault-stream-code">SYS_CHRONO // 1941.00</span>
          <span class="stream-bars" aria-hidden="true">
            <i></i><i></i><i></i><i></i><i></i><i></i>
          </span>
        </div>

        <!-- Главный счетчик эпохи -->
        <div class="vault-year-display">
          <div class="year-sub-caption">ИСТОРИЧЕСКИЙ ХРОНОГРАФ ЭКСПОЗИЦИИ</div>
          <div class="year-digits-row">
            <span id="vault-year-counter" class="vault-year-number">1941</span>
            <span class="vault-year-suffix">ГОД</span>
          </div>
          <div id="vault-milestone-text" class="vault-milestone-text">
            Открытие Дулёвского керамического техникума (ДКТ)
          </div>
        </div>

        <!-- Прогресс-бар синхронизации (0% -> 100%) -->
        <div class="vault-progress-section">
          <div class="vault-progress-labels">
            <span>СИНХРОНИЗАЦИЯ АРХИВНЫХ ФОНДОВ (ДКТ → ЛиДАМТ → ЛДПК)</span>
            <span id="vault-percent-text" class="vault-percent-value">0%</span>
          </div>
          <div class="vault-progress-track">
            <div id="vault-progress-fill" class="vault-progress-fill"></div>
          </div>
        </div>

        <!-- Зона действия (кнопка появляется на 100%) -->
        <div class="vault-action-zone">
          <button type="button" id="vault-enter-btn" class="vault-enter-btn" disabled>
            <span class="enter-btn-glow"></span>
            <span class="enter-btn-text" id="vault-enter-btn-text">ЗАГРУЗКА ХРОНИКИ...</span>
          </button>
          <div class="vault-skip-hint">
            Нажмите <kbd>ESC</kbd> для быстрого пропуска заставки
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    this.dom = {
      root: wrapper,
      hud: document.getElementById('vault-hud-card'),
      laserSeam: document.getElementById('vault-laser-seam'),
      yearCounter: document.getElementById('vault-year-counter'),
      milestoneText: document.getElementById('vault-milestone-text'),
      streamCode: document.getElementById('vault-stream-code'),
      percentText: document.getElementById('vault-percent-text'),
      progressFill: document.getElementById('vault-progress-fill'),
      enterBtn: document.getElementById('vault-enter-btn'),
      enterBtnText: document.getElementById('vault-enter-btn-text'),
      soundBtn: document.getElementById('vault-sound-btn'),
      soundIcon: document.getElementById('vault-sound-icon'),
      soundLabel: document.getElementById('vault-sound-label')
    };

    this.bindEvents();
  }

  bindEvents() {
    // Разблокировка Web Audio API при первом движении мыши или клике по прелоадеру
    const unlockAudio = () => {
      if (!this.synth.isMuted && this.isActive && !this.isClosing) {
        this.synth.initContext();
        this.synth.startProjectorHum();
      }
    };
    this.dom.root.addEventListener('pointerdown', unlockAudio, { once: true });
    this.dom.root.addEventListener('mousemove', unlockAudio, { once: true });

    // Переключатель звука
    this.dom.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = this.synth.toggleMute();
      this.dom.soundIcon.textContent = muted ? '🔇' : '🔊';
      this.dom.soundLabel.textContent = muted ? 'SFX: OFF' : 'SFX: ON';
      this.dom.soundBtn.classList.toggle('muted', muted);
    });

    // Кнопка входа в экспозицию
    this.dom.enterBtn.addEventListener('click', () => {
      this.openVaultShutters(true);
    });

    // Клавиша Escape или Enter
    this.keyHandler = (e) => {
      if (!this.isActive || this.isClosing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.openVaultShutters(false);
      } else if (e.key === 'Enter' && !this.dom.enterBtn.disabled) {
        e.preventDefault();
        this.openVaultShutters(true);
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  startSequence() {
    this.isActive = true;
    this.synth.startProjectorHum();

    const startTime = performance.now();
    const totalYears = this.endYear - this.startYear;

    // Нелинейная кривая плавного разгона и мягкого торможения у 2026 года
    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = (now) => {
      if (!this.isActive || this.isClosing) return;

      const elapsed = now - startTime;
      const rawProgress = Math.min(1, elapsed / this.durationMs);
      const easedProgress = easeInOutCubic(rawProgress);

      const currentYear = Math.round(this.startYear + totalYears * easedProgress);
      const percent = Math.round(rawProgress * 100);

      // Обновляем цифры и прогресс-бар
      this.dom.yearCounter.textContent = currentYear;
      this.dom.percentText.textContent = `${percent}%`;
      this.dom.progressFill.style.width = `${percent}%`;

      // Звуковой щелчок хронографа при смене года
      if (currentYear !== this.lastTickYear) {
        this.lastTickYear = currentYear;
        this.synth.playChronoTick(easedProgress);

        // Обновляем историческую веху
        const activeMilestone = [...this.milestones]
          .reverse()
          .find((m) => currentYear >= m.year);

        if (activeMilestone) {
          this.dom.milestoneText.textContent = activeMilestone.label;
          this.dom.streamCode.textContent = `${activeMilestone.code} // ${currentYear}`;
        }
      }

      if (rawProgress < 1) {
        this.rafId = requestAnimationFrame(animate);
      } else {
        this.completeLoading();
      }
    };

    this.rafId = requestAnimationFrame(animate);
  }

  completeLoading() {
    this.dom.yearCounter.textContent = this.endYear;
    this.dom.percentText.textContent = '100%';
    this.dom.progressFill.style.width = '100%';
    this.dom.enterBtn.disabled = false;
    this.dom.enterBtn.classList.add('ready');
    this.dom.enterBtnText.textContent = 'ВОЙТИ В ЭКСПОЗИЦИЮ';
    this.dom.root.classList.add('vault-ready');
  }

  openVaultShutters(withBoomSound = true) {
    if (this.isClosing) return;
    this.isClosing = true;

    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.keyHandler, true);
    sessionStorage.setItem(this.storageKey, 'true');

    if (withBoomSound) {
      this.synth.playSubBassBoom();
    } else {
      this.synth.stopProjectorHum();
    }

    // Запускаем кинематографичную анимацию раздвигания шторок
    this.dom.root.classList.add('vault-opening');

    setTimeout(() => {
      this.isActive = false;
      if (this.dom.root && this.dom.root.parentNode) {
        this.dom.root.remove();
      }
    }, 1150);
  }
}

/* ==========================================================================
   3. АТМОСФЕРНЫЙ CANVAS-СЛОЙ «МУЗЕЙНАЯ ПЫЛЬ В ЛУЧАХ СВЕТА» (AMBIENT DUST STAGE)
   ========================================================================== */
export class AmbientDustStage {
  constructor(options = {}) {
    this.particleCount = options.particleCount || 64;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.rafId = null;
    this.isRunning = false;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Координаты мыши с плавной инерцией (Lerp)
    this.mouse = {
      targetX: -1000,
      targetY: -1000,
      x: -1000,
      y: -1000,
      radius: 145,
      active: false
    };

    this.init();
  }

  init() {
    this.mountCanvas();
    this.createParticles();
    this.bindEvents();
    this.evaluateRunState();
  }

  mountCanvas() {
    const stage = document.querySelector('.viewport-stage') || document.getElementById('app') || document.body;
    const existing = document.getElementById('ambient-dust-canvas');
    if (existing) existing.remove();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ambient-dust-canvas';
    this.canvas.className = 'ambient-dust-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      // 60% золотистых пылинок (#d4af37) и 40% голубых (#38bdf8)
      const isGold = Math.random() < 0.6;
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -0.08 - Math.random() * 0.24, // Медленный восходящий дрейф в лучах света
        size: 0.9 + Math.random() * 2.1,
        rgb: isGold ? '212, 175, 55' : '56, 189, 248',
        baseAlpha: 0.18 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.012 + Math.random() * 0.025,
        wanderAngle: Math.random() * Math.PI * 2,
        offsetX: 0,
        offsetY: 0
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.handleResize(), { passive: true });

    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = e.clientX;
      this.mouse.targetY = e.clientY;
      this.mouse.active = true;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
      this.mouse.targetX = -1000;
      this.mouse.targetY = -1000;
    }, { passive: true });

    // Авто-пауза при переключении вкладки браузера
    document.addEventListener('visibilitychange', () => {
      this.evaluateRunState();
    });

    // Полная синхронизация с Lite Mode (отслеживание класса .lite-mode на <body>)
    this.bodyObserver = new MutationObserver(() => {
      this.evaluateRunState();
    });
    this.bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /**
   * Проверяет, должен ли работать цикл рендеринга (учитывает Lite Mode и активность вкладки)
   */
  evaluateRunState() {
    const isLiteMode = document.body.classList.contains('lite-mode');
    const isTabHidden = document.hidden;

    if (isLiteMode || isTabHidden) {
      this.stopLoop();
      if (isLiteMode && this.ctx) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    } else {
      this.startLoop();
    }
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderFrame();
  }

  stopLoop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderFrame() {
    if (!this.isRunning) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Отрисовка мягких диагональных музейных лучей света (Volumetric Light Beams)
    const beamGrad = ctx.createLinearGradient(w * 0.15, 0, w * 0.65, h);
    beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.035)');
    beamGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.02)');
    beamGrad.addColorStop(1, 'rgba(15, 15, 18, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Плавная интерполяция (Lerp) курсора мыши для эффекта инерции
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;

    // 3. Обновление физики и отрисовка каждой микро-частицы
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Броуновское покачивание и мерцание
      p.phase += p.phaseSpeed;
      p.wanderAngle += (Math.random() - 0.5) * 0.08;

      p.x += p.vx + Math.cos(p.wanderAngle) * 0.12;
      p.y += p.vy + Math.sin(p.wanderAngle) * 0.06;

      // Бесшовный возврат частиц за пределами экрана
      if (p.y < -15) p.y = h + 15;
      if (p.y > h + 15) p.y = -15;
      if (p.x < -15) p.x = w + 15;
      if (p.x > w + 15) p.x = -15;

      // Мягкое огибание курсора мыши с инерцией (Lerp)
      let targetOffsetX = 0;
      let targetOffsetY = 0;
      let proximityBoost = 0;

      if (this.mouse.active) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const distSq = dx * dx + dy * dy;
        const maxDist = this.mouse.radius;

        if (distSq < maxDist * maxDist && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / maxDist);
          targetOffsetX = (dx / dist) * force * 34;
          targetOffsetY = (dy / dist) * force * 34;
          proximityBoost = force * 0.35;
        }
      }

      p.offsetX += (targetOffsetX - p.offsetX) * 0.07;
      p.offsetY += (targetOffsetY - p.offsetY) * 0.07;

      const drawX = p.x + p.offsetX;
      const drawY = p.y + p.offsetY;

      // Расчет прозрачности с мягким синусоидальным мерцанием
      const twinkle = (Math.sin(p.phase) + 1) * 0.5;
      const alpha = Math.min(0.9, p.baseAlpha * (0.45 + twinkle * 0.55) + proximityBoost);

      // Отрисовка светящегося ореола пылинки
      ctx.beginPath();
      ctx.arc(drawX, drawY, p.size * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.rgb}, ${alpha * 0.22})`;
      ctx.fill();

      // Отрисовка яркого ядра пылинки
      ctx.beginPath();
      ctx.arc(drawX, drawY, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.rgb}, ${alpha})`;
      ctx.fill();
    }

    this.rafId = requestAnimationFrame(() => this.renderFrame());
  }
}

/* ==========================================================================
   4. ЕДИНАЯ ТОЧКА ИНИЦИАЛИЗАЦИИ ДЛЯ APP.JS
   ========================================================================== */
export function initMuseumVFX() {
  const preloader = new TimeVaultPreloader();
  const dustStage = new AmbientDustStage({ particleCount: 64 });

  // Дополнительно: двойной клик по бейджу «МУЗЕЙ ЛДПК» в шапке позволяет
  // в любой момент повторно показать киношное интро (удобно на защите проекта!)
  const brandBadge = document.querySelector('.brand-badge');
  if (brandBadge) {
    brandBadge.style.cursor = 'pointer';
    brandBadge.title = 'Двойной клик — повторить кинематографичное интро (1941–2026)';
    brandBadge.addEventListener('dblclick', () => preloader.replay());
  }

  return { preloader, dustStage };
}