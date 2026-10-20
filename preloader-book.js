// preloader-book.js
/**
 * МОДУЛЬ 1: ИНТРО-ПРЕЛОАДЕР «АРХИВНАЯ ЛЕТОПИСЬ»
 * - Полноэкранный оверлей при первом входе
 * - Интерактивная 3D-книга в благородном переплёте с золотым тиснением
 * - Переворачивающиеся в 3D страницы (CSS perspective / rotateY) по 4 эпохам:
 *   1941, 1958, 1970–1983, 2026
 * - Кнопка «Войти в экспозицию» с латунным свечением + пропуск по Escape
 */

import { globalSoundEngine } from './visual-sound.js';

export class ArchivalBookPreloader {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'ldpk_archival_book_seen_v2';
    this.isActive = false;
    this.isClosing = false;
    this.timers = [];

    this.pagesData = [
      {
        epoch: '1941',
        chapter: 'ГЛАВА I • ИСТОКИ',
        title: 'Основание ДКТ в годы войны',
        desc: 'Открытие Дулёвского керамического техникума в суровом 1941 году. Первые учебные аудитории, подготовка мастеров-технологов и самоотверженный труд студентов и преподавателей.'
      },
      {
        epoch: '1958',
        chapter: 'ГЛАВА II • ИНДУСТРИАЛИЗАЦИЯ',
        title: 'Инженерная база для завода ЛиАЗ',
        desc: 'Становление машиностроительного направления и подготовка первых поколений конструкторов, технологов и инженеров-автомобилестроителей для Ликинского автобусного завода.'
      },
      {
        epoch: '1970–1983',
        chapter: 'ГЛАВА III • СОЗИДАНИЕ',
        title: 'Строительство современных корпусов ЛиДАМТ',
        desc: 'Масштабное возведение нового учебно-лабораторного комплекса, оснащение профильных мастерских и расцвет Ликино-Дулёвского автомеханического техникума.'
      },
      {
        epoch: '2026',
        chapter: 'ГЛАВА IV • НАСТОЯЩЕЕ И БУДУЩЕЕ',
        title: 'Кластер Федерального проекта «Профессионалитет»',
        desc: 'Ликино-Дулёвский политехнический колледж (филиал ГГТУ) — передовой образовательно-производственный кластер и цифровая музейная экспозиция.'
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
      badge.title = 'Двойной клик — открыть «Архивную летопись ЛДПК» (Прелоадер)';
      badge.addEventListener('dblclick', () => this.replay());
    }
  }

  replay() {
    if (this.isActive) return;
    sessionStorage.removeItem(this.storageKey);
    this.isClosing = false;
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

    const sheetsHtml = this.pagesData.map((p, index) => `
      <div class="book-sheet" id="book-sheet-${index}" style="z-index: ${20 - index};">
        <div class="sheet-face sheet-front">
          <div class="sheet-ornament-border">
            <div class="sheet-header-meta">
              <span class="sheet-chapter">${p.chapter}</span>
              <span class="sheet-folio">ЛИСТ 0${index + 1}</span>
            </div>
            <div class="sheet-year-emblem">${p.epoch}</div>
            <div class="sheet-brass-divider"></div>
            <h3 class="sheet-milestone-title">${p.title}</h3>
            <p class="sheet-milestone-desc">${p.desc}</p>
            <div class="sheet-footer-stamp">
              <span>АРХИВНЫЙ ФОНД ЛДПК</span>
              <span>№ ${1941 + index * 25}</span>
            </div>
          </div>
        </div>
        <div class="sheet-face sheet-back">
          <div class="sheet-ornament-border back-pattern">
            <div class="back-watermark">ЛДПК • ${p.epoch}</div>
            <div class="back-seal-ornament">✦</div>
            <p class="back-quote">«Бережно храня традиции прошлого, созидаем инженерное будущее края»</p>
          </div>
        </div>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="book-ambient-spotlight"></div>

      <div class="book-stage-container">
        <!-- Верхний заголовок заставки -->
        <div class="book-stage-header">
          <span class="book-museum-subtitle">ГОСУДАРСТВЕННЫЙ ГУМАНИТАРНО-ТЕХНОЛОГИЧЕСКИЙ УНИВЕРСИТЕТ</span>
          <h1 class="book-museum-main-title">Архивная летопись ЛДПК</h1>
        </div>

        <!-- 3D Книга в благородном переплёте -->
        <div class="archival-book-3d" id="archival-book-3d">
          <!-- Левая крышка переплёта (основание разворота) -->
          <div class="book-base-left">
            <div class="left-spread-inner">
              <span class="spread-crest">🏛</span>
              <h4>МУЗЕЙ ИСТОРИИ КОЛЛЕДЖА</h4>
              <p>Экспозиция охватывает более 85 лет трудовых, боевых и академических свершений: от Дулёвского керамического техникума (1941) до кластера «Профессионалитет» (2026).</p>
              <div class="spread-signature">Ликино-Дулёво • Основано в 1941 г.</div>
            </div>
          </div>

          <!-- Правая крышка переплёта -->
          <div class="book-base-right"></div>

          <!-- Корешок книги -->
          <div class="book-spine"></div>

          <!-- Переворачивающиеся 3D-страницы с вехами -->
          ${sheetsHtml}

          <!-- Лицевая твёрдая обложка с золотым тиснением -->
          <div class="book-front-cover" id="book-front-cover" style="z-index: 30;">
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
                <span class="exlibris-label">EX LIBRIS • ФОНД МУЗЕЯ</span>
                <strong>Ликино-Дулёвский политехнический колледж</strong>
                <span>Хроника становления и триумфов</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Нижняя панель статуса загрузки и кнопка входа -->
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
      if (!this.dom.enterBtn.disabled) {
        this.closeBookAndEnter();
      }
    });

    this.dom.skipBtn.addEventListener('click', () => {
      this.closeBookAndEnter();
    });

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

  runChronicleSequence() {
    this.isActive = true;
    this.clearTimers();

    const setProgress = (pct, label) => {
      if (!this.dom) return;
      this.dom.progressPercent.textContent = `${pct}%`;
      this.dom.progressFill.style.width = `${pct}%`;
      if (label) this.dom.statusLabel.textContent = label;
    };

    // Шаг 1: Раскрытие лицевой обложки книги
    this.timers.push(setTimeout(() => {
      this.dom.book3d.classList.add('book-opened');
      this.dom.frontCover.classList.add('flipped');
      globalSoundEngine?.playBookCoverClick();
      setProgress(20, '1941 г. — Основание ДКТ в годы войны');
    }, 450));

    // Шаг 2: Переворот страницы 1 -> 1958
    this.timers.push(setTimeout(() => {
      const sheet0 = document.getElementById('book-sheet-0');
      sheet0?.classList.add('flipped');
      globalSoundEngine?.playPageFlip();
      setProgress(48, '1958 г. — Инженерная база для завода ЛиАЗ');
    }, 1550));

    // Шаг 3: Переворот страницы 2 -> 1970–1983
    this.timers.push(setTimeout(() => {
      const sheet1 = document.getElementById('book-sheet-1');
      sheet1?.classList.add('flipped');
      globalSoundEngine?.playPageFlip();
      setProgress(76, '1970–1983 гг. — Строительство современных корпусов ЛиДАМТ');
    }, 2650));

    // Шаг 4: Переворот страницы 3 -> открыта страница 2026 (100% готовность)
    this.timers.push(setTimeout(() => {
      const sheet2 = document.getElementById('book-sheet-2');
      sheet2?.classList.add('flipped');
      globalSoundEngine?.playPageFlip();
      setProgress(100, '2026 г. — Кластер Федерального проекта «Профессионалитет»');

      this.dom.enterBtn.disabled = false;
      this.dom.enterBtn.classList.add('ready');
      this.dom.enterText.textContent = 'Войти в экспозицию';
      globalSoundEngine?.playBookCoverClick();
    }, 3750));
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

export function initArchivalBookPreloader() {
  return new ArchivalBookPreloader();
}