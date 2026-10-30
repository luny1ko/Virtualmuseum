// preloader-book.js
/**
 * МОДУЛЬ 1: ИНТРО-ПРЕЛОАДЕР «АРХИВНАЯ ЛЕТОПИСЬ»
 * - Полноэкранный оверлей при первом входе
 * - Интерактивная 3D-книга в благородном переплёте с золотым тиснением
 * - Переворачивающиеся в 3D страницы (CSS perspective / rotateY) по 4 эпохам:
 *   1941, 1958, 1970–1983, 2026
 * - Кнопка «Войти в экспозицию» с латунным свечением + пропуск по Escape
 */

// vfx-engine.js — ИСПРАВЛЕННЫЙ МОДУЛЬ КНИГИ-ПРЕЛОАДЕРА И АТМОСФЕРНОЙ ПЫЛИ
import { globalSoundEngine } from './visual-sound.js';

export class ArchivalBookPreloader {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'ldpk_archival_book_seen_v2';
    this.isActive = false;
    this.isClosing = false;
    this.currentStep = 0;
    this.timers = [];

    // Единый источник данных для синхронизации левого и правого разворотов
    this.pagesData = [
      {
        epoch: '1941',
        leftHeader: 'ЛДПК • 1941',
        folio: 'ЛИСТ 01',
        chapter: 'ГЛАВА I • ИСТОКИ',
        title: 'Основание ДКТ в годы войны',
        desc: 'Открытие Дулёвского керамического техникума в суровом 1941 году. Первые учебные аудитории, подготовка мастеров-технологов и самоотверженный труд студентов и преподавателей.',
        progress: 22
      },
      {
        epoch: '1958',
        leftHeader: 'ЛДПК • 1958',
        folio: 'ЛИСТ 02',
        chapter: 'ГЛАВА II • ИНДУСТРИАЛИЗАЦИЯ',
        title: 'Инженерная база для завода ЛиАЗ',
        desc: 'Становление машиностроительного направления и подготовка первых поколений конструкторов, технологов и инженеров-автомобилестроителей для Ликинского автобусного завода.',
        progress: 50
      },
      {
        epoch: '1970–1983',
        leftHeader: 'ЛДПК • 1970–1983',
        folio: 'ЛИСТ 03',
        chapter: 'ГЛАВА III • СОЗИДАНИЕ',
        title: 'Строительство современных корпусов ЛиДАМТ',
        desc: 'Масштабное возведение нового учебно-лабораторного комплекса, оснащение профильных мастерских и расцвет Ликино-Дулёвского автомеханического техникума.',
        progress: 78
      },
      {
        epoch: '2026',
        leftHeader: 'ЛДПК • 2026',
        folio: 'ЛИСТ 04',
        chapter: 'ГЛАВА IV • НАСТОЯЩЕЕ И БУДУЩЕЕ',
        title: 'Кластер Федерального проекта «Профессионалитет»',
        desc: 'Ликино-Дулёвский политехнический колледж (филиал ГГТУ) — передовой образовательно-производственный кластер и цифровая музейная экспозиция.',
        progress: 100
      }
    ];

    this.init();
  }

  init() {
    if (sessionStorage.getItem(this.storageKey) === 'true') {
      this.bindBrandBadgeReplay();
      return;
    }
    this.mountBookDOM();
    this.runChronicleSequence();
    this.bindBrandBadgeReplay();
  }

  bindBrandBadgeReplay() {
    const badge = document.querySelector('.brand-badge');
    if (badge && !badge.dataset.bookReplayBound) {
      badge.dataset.bookReplayBound = 'true';
      badge.style.cursor = 'pointer';
      badge.title = 'Двойной клик — открыть «Архивную летопись ЛДПК»';
      badge.addEventListener('dblclick', () => this.replay());
    }
  }

  replay() {
    if (this.isActive) return;
    sessionStorage.removeItem(this.storageKey);
    this.isClosing = false;
    this.currentStep = 0;
    this.mountBookDOM();
    this.runChronicleSequence();
  }

  mountBookDOM() {
    const existing = document.getElementById('archival-book-preloader');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'archival-book-preloader';
    overlay.className = 'book-preloader-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Архивная летопись колледжа ЛДПК');

    // Генерируем листы книги; на обратной стороне (.sheet-back) ставим колонтитул СЛЕДУЮЩЕЙ эпохи,
    // которая открывается на правом развороте при перевороте текущего листа
    const sheetsHtml = this.pagesData.map((p, index) => {
      const nextStepData = this.pagesData[Math.min(index + 1, this.pagesData.length - 1)];
      return `
        <div class="book-sheet" id="book-sheet-${index}" data-sheet-index="${index}" style="z-index: ${20 - index};">
          <div class="sheet-face sheet-front">
            <div class="sheet-ornament-border">
              <div class="sheet-header-meta">
                <span class="sheet-chapter">${p.chapter}</span>
                <span class="sheet-folio">${p.folio}</span>
              </div>
              <div class="sheet-year-emblem">${p.epoch}</div>
              <div class="sheet-brass-divider"></div>
              <h3 class="sheet-milestone-title">${p.title}</h3>
              <p class="sheet-milestone-desc">${p.desc}</p>
              <div class="sheet-footer-stamp">
                <span>АРХИВНЫЙ ФОНД ЛДПК</span>
                <span>ЭПОХА: ${p.epoch}</span>
              </div>
            </div>
          </div>
          <div class="sheet-face sheet-back">
            <div class="sheet-ornament-border back-pattern">
              <div class="back-watermark" data-back-watermark="${index}">${nextStepData.leftHeader}</div>
              <div class="back-seal-ornament">✦</div>
              <p class="back-quote">«Бережно храня традиции прошлого, созидаем инженерное будущее края»</p>
              <div class="sheet-footer-stamp" style="width:100%; margin-top:auto;">
                <span>ЛЕТОПИСЬ КОЛЛЕДЖА</span>
                <span>${nextStepData.folio}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="book-ambient-spotlight"></div>

      <div class="book-stage-container">
        <div class="book-stage-header">
          <span class="book-museum-subtitle">ГОСУДАРСТВЕННЫЙ ГУМАНИТАРНО-ТЕХНОЛОГИЧЕСКИЙ УНИВЕРСИТЕТ</span>
          <h1 class="book-museum-main-title">Архивная летопись ЛДПК</h1>
        </div>

        <div class="archival-book-3d" id="archival-book-3d">
          <!-- Левая страница разворота с синхронизированным колонтитулом -->
          <div class="book-base-left">
            <div class="left-spread-inner">
              <div class="back-watermark" id="book-left-master-header">ЛДПК • 1941</div>
              <span class="spread-crest">🏛</span>
              <h4 id="book-left-master-title">Основание ДКТ в годы войны</h4>
              <p>Экспозиция охватывает более 85 лет трудовых, боевых и академических свершений: от Дулёвского керамического техникума (1941) до кластера «Профессионалитет» (2026).</p>
              <div class="spread-signature" id="book-left-master-folio">ЛИСТ 01 • ИСТОРИЧЕСКИЙ АРХИВ</div>
            </div>
          </div>

          <div class="book-base-right"></div>
          <div class="book-spine"></div>

          ${sheetsHtml}

          <!-- Лицевая твёрдая обложка -->
          <div class="book-front-cover" id="book-front-cover" style="z-index: 25;">
            <div class="cover-face cover-front-outer">
              <div class="cover-gold-frame">
                <span class="cover-corner tl"></span>
                <span class="cover-corner tr"></span>
                <span class="cover-corner bl"></span>
                <span class="cover-corner br"></span>

                <span class="cover-top-label">ИСТОРИЧЕСКИЙ ФОНД</span>
                <div class="cover-emblem-medallion">
                  <span class="medallion-inner">ЛДПК</span>
                </div>
                <h2 class="cover-embossed-title">ЛЕТОПИСЬ<br>КОЛЛЕДЖА</h2>
                <div class="cover-years-band">1941 — 2026</div>
                <span class="cover-bottom-caption">АРХИТЕКТУРНАЯ ЭКСПОЗИЦИЯ</span>
              </div>
            </div>
            <div class="cover-face cover-front-inner">
              <div class="exlibris-card">
                <span class="exlibris-label" id="cover-inner-epoch-tag">ЛДПК • 1941</span>
                <strong>Ликино-Дулёвский политехнический колледж</strong>
                <span id="cover-inner-chapter-tag">ГЛАВА I • ЛИСТ 01</span>
              </div>
            </div>
          </div>
        </div>

        <div class="book-controls-Dock">
          <div class="book-progress-row">
            <span id="book-status-label" class="book-status-label">Отпирание архивного переплёта...</span>
            <span id="book-progress-percent" class="book-progress-percent">0%</span>
          </div>
          <div class="book-progress-bar">
            <div id="book-progress-fill" class="book-progress-fill"></div>
          </div>

          <div class="book-enter-actions">
            <button type="button" id="btn-enter-exposition" class="btn-enter-exposition" disabled>
              <span class="btn-brass-shimmer"></span>
              <span id="btn-enter-text">Чтение летописи...</span>
            </button>
            <button type="button" id="btn-skip-book" class="btn-skip-book">
              Пропустить заставку <kbd>ESC</kbd>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    this.dom = {
      overlay,
      book3d: document.getElementById('archival-book-3d'),
      frontCover: document.getElementById('book-front-cover'),
      leftMasterHeader: document.getElementById('book-left-master-header'),
      leftMasterTitle: document.getElementById('book-left-master-title'),
      leftMasterFolio: document.getElementById('book-left-master-folio'),
      coverInnerEpoch: document.getElementById('cover-inner-epoch-tag'),
      coverInnerChapter: document.getElementById('cover-inner-chapter-tag'),
      statusLabel: document.getElementById('book-status-label'),
      progressPercent: document.getElementById('book-progress-percent'),
      progressFill: document.getElementById('book-progress-fill'),
      enterBtn: document.getElementById('btn-enter-exposition'),
      enterText: document.getElementById('btn-enter-text'),
      skipBtn: document.getElementById('btn-skip-book')
    };

    this.bindEvents();
  }

  bindEvents() {
    this.dom.enterBtn.addEventListener('click', () => {
      if (!this.dom.enterBtn.disabled) this.closeBookAndEnter();
    });

    this.dom.skipBtn.addEventListener('click', () => this.closeBookAndEnter());

    this.keyListener = (e) => {
      if (!this.isActive || this.isClosing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeBookAndEnter();
      } else if (e.key === 'Enter' && !this.dom.enterBtn.disabled) {
        e.preventDefault();
        this.closeBookAndEnter();
      }
    };
    window.addEventListener('keydown', this.keyListener);
  }

  /**
   * СТРОГАЯ СИНХРОНИЗАЦИЯ ШАГА РАЗВОРОТА (устраняет сброс на «ЛДПК • 1941»)
   */
  applyStepState(stepIndex) {
    if (!this.dom || this.isClosing) return;
    this.currentStep = stepIndex;
    const step = this.pagesData[stepIndex];
    if (!step) return;

    // 1. Синхронно обновляем все левые колонтитулы и вотермарки на активный шаг
    if (this.dom.leftMasterHeader) this.dom.leftMasterHeader.textContent = step.leftHeader;
    if (this.dom.leftMasterTitle) this.dom.leftMasterTitle.textContent = step.title;
    if (this.dom.leftMasterFolio) this.dom.leftMasterFolio.textContent = `${step.folio} • ${step.chapter}`;
    if (this.dom.coverInnerEpoch) this.dom.coverInnerEpoch.textContent = step.leftHeader;
    if (this.dom.coverInnerChapter) this.dom.coverInnerChapter.textContent = `${step.chapter} • ${step.folio}`;

    // Синхронизируем все видимые обратные стороны перевёрнутых страниц
    this.dom.overlay.querySelectorAll('.back-watermark').forEach((el) => {
      el.textContent = step.leftHeader;
    });

    // 2. Переворачиваем нужные листы и пересчитываем z-index,
    // чтобы последний перевёрнутый лист ВСЕГДА лежал поверх предыдущих (30 + i)
    this.pagesData.forEach((_, idx) => {
      const sheetEl = document.getElementById(`book-sheet-${idx}`);
      if (!sheetEl) return;

      if (idx < stepIndex) {
        if (!sheetEl.classList.contains('flipped')) {
          sheetEl.classList.add('flipped');
        }
        // На левой стороне книги более поздний лист должен иметь БОЛЬШИЙ z-index
        sheetEl.style.zIndex = String(30 + idx);
      } else {
        sheetEl.classList.remove('flipped');
        // На правой стороне книги верхний лист имеет больший z-index (20 - idx)
        sheetEl.style.zIndex = String(20 - idx);
      }
    });

    // Обложка после открытия лежит в самом низу левой стопки (z-index: 10)
    if (this.dom.frontCover && this.dom.frontCover.classList.contains('flipped')) {
      this.dom.frontCover.style.zIndex = '10';
    }

    // 3. Синхронно обновляем прогресс-бар и статусную строку
    this.dom.progressPercent.textContent = `${step.progress}%`;
    this.dom.progressFill.style.width = `${step.progress}%`;
    this.dom.statusLabel.textContent = `${step.epoch} г. — ${step.title}`;

    // 4. Если достигнут финальный шаг (2026) — активируем кнопку входа
    if (stepIndex === this.pagesData.length - 1) {
      this.dom.enterBtn.disabled = false;
      this.dom.enterBtn.classList.add('ready');
      this.dom.enterText.textContent = 'Войти в экспозицию';
      globalSoundEngine?.playBookCoverClick();
    }
  }

  runChronicleSequence() {
    this.isActive = true;
    this.clearTimers();

    // Шаг 0 (450 мс): Открываем обложку -> фиксируется 1941 (ЛИСТ 01)
    this.timers.push(setTimeout(() => {
      this.dom.book3d.classList.add('book-opened');
      this.dom.frontCover.classList.add('flipped');
      globalSoundEngine?.playBookCoverClick();
      this.applyStepState(0);
    }, 450));

    // Шаг 1 (1600 мс): Переворот на 1958 (ЛИСТ 02)
    this.timers.push(setTimeout(() => {
      globalSoundEngine?.playPageFlip();
      this.applyStepState(1);
    }, 1600));

    // Шаг 2 (2750 мс): Переворот на 1970–1983 (ЛИСТ 03)
    this.timers.push(setTimeout(() => {
      globalSoundEngine?.playPageFlip();
      this.applyStepState(2);
    }, 2750));

    // Шаг 3 (3900 мс): Переворот на 2026 (ЛИСТ 04, 100%)
    this.timers.push(setTimeout(() => {
      globalSoundEngine?.playPageFlip();
      this.applyStepState(3);
    }, 3900));
  }

  clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  closeBookAndEnter() {
    if (this.isClosing) return;
    this.isClosing = true;
    this.clearTimers();
    window.removeEventListener('keydown', this.keyListener);
    sessionStorage.setItem(this.storageKey, 'true');

    globalSoundEngine?.playSubBassPulse();
    this.dom.overlay.classList.add('fade-out-cinematic');

    setTimeout(() => {
      this.isActive = false;
      if (this.dom.overlay && this.dom.overlay.parentNode) {
        this.dom.overlay.remove();
      }
    }, 850);
  }
}

/* ==========================================================================
   АТМОСФЕРНЫЙ СЛОЙ ЧАСТИЦ В ЛУЧАХ МУЗЕЙНОГО СВЕТА (AMBIENT DUST STAGE)
   ========================================================================== */
export class AmbientDustStage {
  constructor(options = {}) {
    this.particleCount = options.particleCount || 52;
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.rafId = null;
    this.isRunning = false;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.init();
  }

  init() {
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
    this.createParticles();

    window.addEventListener('resize', () => this.handleResize(), { passive: true });
    document.addEventListener('visibilitychange', () => this.evaluateRunState());

    const obs = new MutationObserver(() => this.evaluateRunState());
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.evaluateRunState();
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
    this.particles = Array.from({ length: this.particleCount }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.06 - Math.random() * 0.18,
      size: 0.8 + Math.random() * 1.9,
      rgb: Math.random() < 0.75 ? '212, 175, 55' : '245, 242, 235',
      baseAlpha: 0.14 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.01 + Math.random() * 0.02
    }));
  }

  evaluateRunState() {
    if (document.body.classList.contains('lite-mode') || document.hidden) {
      this.isRunning = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
    } else if (!this.isRunning) {
      this.isRunning = true;
      this.renderFrame();
    }
  }

  renderFrame() {
    if (!this.isRunning) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.phase += p.phaseSpeed;
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -10) p.y = this.height + 10;
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;

      const alpha = p.baseAlpha * (0.5 + 0.5 * Math.sin(p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.rgb}, ${alpha.toFixed(3)})`;
      ctx.fill();
    }
    this.rafId = requestAnimationFrame(() => this.renderFrame());
  }
}

export function initArchivalBookPreloader() {
  return new ArchivalBookPreloader();
}

export function initMuseumVFX() {
  const preloader = new ArchivalBookPreloader();
  const dustStage = new AmbientDustStage({ particleCount: 52 });
  return { preloader, dustStage };
}