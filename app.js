// app.js
/**
 * Архитектурный класс "Виртуальный музей ЛДПК"
 * Включает:
 * 1. Интерактивный архитектурный план здания со сквозным телепортом к витринам.
 * 2. Выдвижной каталог экспонатов снизу (Bottom Sheet) с фильтрацией по залам.
 * 3. Модуль интерактивной викторины (Quiz Modal) по истории колледжа.
 * 4. Облегчённый режим (Lite Mode) для экономии ресурсов GPU/CPU.
 * 5. Аппаратный 3D-просмотр GLB/GLTF моделей без сброса WebGL-контекста.
 * 6. Аудиогид на базе Web Speech API.
 */
class MuseumApp {
  constructor() {
    this.data = { halls: [] };
    this.currentHall = null;
    this.isTransitioning = false;
    this.currentSpeechUtterance = null;
    this.isAudioPlaying = false;
    this.availableVoices = [];

    this.currentSpot = null;
    this.currentImageIndex = 0;
    this.isMapOpen = false;
    this.isLiteMode = false;

    // Состояния Каталога и Викторины
    this.isCatalogOpen = false;
    this.catalogFilter = 'all';
    this.isQuizOpen = false;
    this.quizCurrentIndex = 0;
    this.quizScore = 0;

    // Банк вопросов для викторины по истории ЛДПК
    this.quizQuestions = [
      {
        question: "В каком году было основано учебное заведение и под каким первоначальным названием?",
        options: [
          "1941 г. — Дулёвский керамический техникум (ДКТ)",
          "1958 г. — Машиностроительный колледж",
          "1970 г. — Ликинский автобусный лицей",
          "1930 г. — Промышленное училище"
        ],
        correct: 0,
        explanation: "История колледжа началась в суровом 1941 году с открытия Дулёвского керамического техникума (ДКТ)."
      },
      {
        question: "Для какого градообразующего завода колледж готовил кадры инженеров-автомобилестроителей?",
        options: [
          "ЗиЛ (Москва)",
          "ЛиАЗ (Ликинский автобусный завод)",
          "ГАЗ (Нижний Новгород)",
          "КАМАЗ"
        ],
        correct: 1,
        explanation: "Колледж (ЛиДАМТ) стал главной кузницей инженеров и мастеров для Ликинского автобусного завода."
      },
      {
        question: "Какой исторический механический калькулятор представлен в Зале 1?",
        options: [
          "Электронная машина БЭСМ",
          "Арифмометр механический «Феликс»",
          "Логарифмическая линейка Энигма",
          "Печатная машинка Ундервуд"
        ],
        correct: 1,
        explanation: "Арифмометр «Феликс» — легендарный рычажный механический калькулятор, на котором считали студенты до появления ЭВМ."
      },
      {
        question: "Какие всемирно известные шедевры представлены в Зале 2 (Быт и культура края)?",
        options: [
          "Дулёвский фарфор заводов Кузнецова и Гарднера",
          "Гжельская синяя майолика",
          "Хохломские деревянные ложки",
          "Павловопосадские шали"
        ],
        correct: 0,
        explanation: "Дулёвский фарфор фабрик Товарищества М. С. Кузнецова и Гарднера — историческая гордость края."
      },
      {
        question: "В каком ключевом федеральном проекте колледж развивает кластеры сегодня?",
        options: [
          "«Цифровая экономика»",
          "«Профессионалитет»",
          "«Ворлдскиллс Россия»",
          "«Университет 2035»"
        ],
        correct: 1,
        explanation: "ЛДПК входит в флагманский президентский проект «Профессионалитет», готовя востребованные кадры."
      }
    ];

    this.dom = {
      nav: document.getElementById('hall-nav'),
      navPill: document.getElementById('nav-pill'),
      video: document.getElementById('hall-video'),
      bgLayer: document.getElementById('hall-bg'),
      hotspotsLayer: document.getElementById('hotspots-layer'),
      statusBadge: document.getElementById('system-status'),
      loader: document.getElementById('transition-loader'),

      // Кнопки верхней панели
      btnOpenMap: document.getElementById('btn-open-map'),
      btnOpenCatalog: document.getElementById('btn-open-catalog'),
      btnOpenQuiz: document.getElementById('btn-open-quiz'),
      btnToggleLite: document.getElementById('btn-toggle-lite'),
      liteBtnText: document.getElementById('lite-btn-text'),

      // Карта здания
      mapModal: document.getElementById('map-modal'),
      mapBackdrop: document.getElementById('map-modal-backdrop'),
      mapCloseBtn: document.getElementById('map-close-btn'),
      svgMap: document.getElementById('museum-svg-map'),
      mapNodesLayer: document.getElementById('map-dynamic-nodes-layer'),

      // Каталог экспонатов (Bottom Sheet)
      catalogSheet: document.getElementById('catalog-sheet'),
      catalogBackdrop: document.getElementById('catalog-backdrop'),
      catalogCloseBtn: document.getElementById('catalog-close-btn'),
      catalogFilters: document.getElementById('catalog-filters'),
      catalogGrid: document.getElementById('catalog-grid'),

      // Викторина (Quiz Modal)
      quizModal: document.getElementById('quiz-modal'),
      quizBackdrop: document.getElementById('quiz-backdrop'),
      quizCloseBtn: document.getElementById('quiz-close-btn'),
      quizBody: document.getElementById('quiz-body'),

      // Шторка витрины (Drawer)
      drawer: document.getElementById('exhibit-drawer'),
      drawerBackdrop: document.getElementById('drawer-backdrop'),
      drawerCloseBtn: document.getElementById('drawer-close'),
      drawerEpoch: document.getElementById('drawer-epoch'),
      drawerTitle: document.getElementById('drawer-title'),
      drawerDesc: document.getElementById('drawer-description'),
      drawerExtraInfo: document.getElementById('drawer-extra-info'),
      
      mediaModeToggle: document.getElementById('media-mode-toggle'),
      btnMode3D: document.getElementById('btn-mode-3d'),
      btnModeGallery: document.getElementById('btn-mode-gallery'),
      modelWrapper: document.getElementById('model-3d-wrapper'),
      modelViewer: document.getElementById('drawer-model'),
      galleryWrapper: document.getElementById('gallery-wrapper'),
      galleryImg: document.getElementById('gallery-current-img'),
      galleryPrev: document.getElementById('gallery-prev'),
      galleryNext: document.getElementById('gallery-next'),
      galleryCaption: document.getElementById('gallery-caption-text'),
      galleryCounter: document.getElementById('gallery-counter'),
      galleryDots: document.getElementById('gallery-dots'),

      audioBtn: document.getElementById('audioguide-btn'),
      audioBtnLabel: document.getElementById('audioguide-text')
    };

    this.init();
  }

  async init() {
    this.initLiteModeState();
    this.bindEvents();
    this.initSpeechSynth();
    await this.loadExhibitsData('exhibits.json');
  }

  initLiteModeState() {
    const saved = localStorage.getItem('museum_lite_mode');
    this.isLiteMode = saved === 'true';
    this.applyLiteMode(this.isLiteMode);
  }

  applyLiteMode(active) {
    this.isLiteMode = active;
    document.body.classList.toggle('lite-mode', active);
    if (this.dom.btnToggleLite) {
      this.dom.btnToggleLite.classList.toggle('active', active);
    }
    if (this.dom.liteBtnText) {
      this.dom.liteBtnText.textContent = active ? 'Lite (Вкл)' : 'Lite';
    }
    localStorage.setItem('museum_lite_mode', active.toString());
  }

  toggleLiteMode() {
    this.applyLiteMode(!this.isLiteMode);
  }

  bindEvents() {
    // Безопасная привязка обработчиков с проверкой на null
    if (this.dom.drawerCloseBtn) {
      this.dom.drawerCloseBtn.addEventListener('click', () => this.closeDrawer());
    }
    if (this.dom.drawerBackdrop) {
      this.dom.drawerBackdrop.addEventListener('click', () => this.closeDrawer());
    }

    // Карта здания
    if (this.dom.btnOpenMap) {
      this.dom.btnOpenMap.addEventListener('click', () => this.toggleMap());
    }
    if (this.dom.mapCloseBtn) {
      this.dom.mapCloseBtn.addEventListener('click', () => this.closeMap());
    }
    if (this.dom.mapBackdrop) {
      this.dom.mapBackdrop.addEventListener('click', () => this.closeMap());
    }

    // Каталог экспонатов (Bottom Sheet)
    if (this.dom.btnOpenCatalog) {
      this.dom.btnOpenCatalog.addEventListener('click', () => this.openCatalog());
    }
    if (this.dom.catalogCloseBtn) {
      this.dom.catalogCloseBtn.addEventListener('click', () => this.closeCatalog());
    }
    if (this.dom.catalogBackdrop) {
      this.dom.catalogBackdrop.addEventListener('click', () => this.closeCatalog());
    }
    if (this.dom.catalogFilters) {
      this.dom.catalogFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        this.dom.catalogFilters.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        this.catalogFilter = btn.getAttribute('data-filter') || 'all';
        this.renderCatalogItems();
      });
    }

    // Викторина (Quiz Modal)
    if (this.dom.btnOpenQuiz) {
      this.dom.btnOpenQuiz.addEventListener('click', () => this.openQuiz());
    }
    if (this.dom.quizCloseBtn) {
      this.dom.quizCloseBtn.addEventListener('click', () => this.closeQuiz());
    }
    if (this.dom.quizBackdrop) {
      this.dom.quizBackdrop.addEventListener('click', () => this.closeQuiz());
    }

    // Lite Mode
    if (this.dom.btnToggleLite) {
      this.dom.btnToggleLite.addEventListener('click', () => this.toggleLiteMode());
    }

    // Горячие клавиши
    window.addEventListener('keydown', (event) => {
      if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
        const isEditing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        if (!isEditing) {
          event.preventDefault();
          this.toggleMap();
        }
      }

      if (event.key === 'Escape') {
        if (this.isQuizOpen) { this.closeQuiz(); return; }
        if (this.isCatalogOpen) { this.closeCatalog(); return; }
        if (this.isMapOpen) { this.closeMap(); return; }
        if (this.dom.drawer && this.dom.drawer.classList.contains('active')) { this.closeDrawer(); }
      }

      if (this.dom.drawer && this.dom.drawer.classList.contains('active')) {
        if (event.key === 'ArrowLeft') this.prevImage();
        if (event.key === 'ArrowRight') this.nextImage();
      }
    });

    window.addEventListener('resize', () => {
      if (this.currentHall) {
        const activeBtn = document.getElementById(`nav-hall-${this.currentHall.id}`);
        this.positionPill(activeBtn);
      }
    });

    if (this.dom.galleryPrev) {
      this.dom.galleryPrev.addEventListener('click', () => this.prevImage());
    }
    if (this.dom.galleryNext) {
      this.dom.galleryNext.addEventListener('click', () => this.nextImage());
    }

    if (this.dom.btnMode3D) {
      this.dom.btnMode3D.addEventListener('click', () => this.setMediaMode('3d'));
    }
    if (this.dom.btnModeGallery) {
      this.dom.btnModeGallery.addEventListener('click', () => this.setMediaMode('gallery'));
    }

    if (this.dom.audioBtn) {
      this.dom.audioBtn.addEventListener('click', () => this.toggleAudioguide());
    }
    if (this.dom.video) {
      this.dom.video.addEventListener('error', (e) => this.handleVideoError(e));
    }

    this.bindSvgMapEvents();
  }

  bindSvgMapEvents() {
    const hallGroups = document.querySelectorAll('.map-hall-group');
    hallGroups.forEach((group) => {
      group.addEventListener('click', (e) => {
        if (e.target.closest('.map-vitrine-node')) return;
        const hallId = group.getAttribute('data-hall-id');
        if (hallId && hallId !== this.currentHall?.id) {
          this.closeMap();
          this.switchHall(hallId);
        }
      });
    });
  }

  /* ==========================================================================
     МЕТОДЫ КАТАЛОГА (BOTTOM SHEET)
     ========================================================================== */
  openCatalog() {
    this.isCatalogOpen = true;
    this.renderCatalogItems();
    if (this.dom.catalogBackdrop) this.dom.catalogBackdrop.classList.add('active');
    if (this.dom.catalogSheet) this.dom.catalogSheet.classList.add('active');
    if (this.dom.btnOpenCatalog) this.dom.btnOpenCatalog.classList.add('active');
  }

  closeCatalog() {
    this.isCatalogOpen = false;
    if (this.dom.catalogSheet) this.dom.catalogSheet.classList.remove('active');
    if (this.dom.catalogBackdrop) this.dom.catalogBackdrop.classList.remove('active');
    if (this.dom.btnOpenCatalog) this.dom.btnOpenCatalog.classList.remove('active');
  }

  renderCatalogItems() {
    if (!this.dom.catalogGrid) return;
    this.dom.catalogGrid.innerHTML = '';
    const allHalls = this.data.halls || [];

    allHalls.forEach((hall) => {
      if (this.catalogFilter !== 'all' && this.catalogFilter !== hall.id) {
        return;
      }

      const hotspots = hall.hotspots || [];
      hotspots.forEach((spot) => {
        const card = document.createElement('div');
        card.className = 'catalog-card';

        const previewImg = (spot.images && spot.images.length > 0)
          ? spot.images[0].url
          : (hall.bgImage || 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80');

        const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');

        card.innerHTML = `
          <div class="card-media-box">
            <img src="${previewImg}" alt="${this.escapeHtml(spot.title)}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'">
            <span class="card-hall-badge">${this.escapeHtml(hall.name)}</span>
            ${has3D ? '<span class="card-3d-badge">3D Модель</span>' : ''}
          </div>
          <div class="card-content">
            <h3 class="card-title">${this.escapeHtml(spot.title)}</h3>
            <span class="card-epoch">${this.escapeHtml(spot.epoch || 'Исторический фонд')}</span>
            <p class="card-desc">${this.escapeHtml(spot.description || '')}</p>
            <div class="card-action-btn">Смотреть стенд →</div>
          </div>
        `;

        card.addEventListener('click', () => {
          this.closeCatalog();
          this.teleportToVitrine(hall.id, spot.id);
        });

        this.dom.catalogGrid.appendChild(card);
      });
    });
  }

  /* ==========================================================================
     МЕТОДЫ МОДУЛЯ ВИКТОРИНЫ (QUIZ MODAL)
     ========================================================================== */
  openQuiz() {
    this.isQuizOpen = true;
    this.quizCurrentIndex = 0;
    this.quizScore = 0;
    this.renderQuizStep();
    if (this.dom.quizBackdrop) this.dom.quizBackdrop.classList.add('active');
    if (this.dom.quizModal) this.dom.quizModal.classList.add('active');
    if (this.dom.btnOpenQuiz) this.dom.btnOpenQuiz.classList.add('active');
  }

  closeQuiz() {
    this.isQuizOpen = false;
    if (this.dom.quizModal) this.dom.quizModal.classList.remove('active');
    if (this.dom.quizBackdrop) this.dom.quizBackdrop.classList.remove('active');
    if (this.dom.btnOpenQuiz) this.dom.btnOpenQuiz.classList.remove('active');
  }

  renderQuizStep() {
    if (!this.dom.quizBody) return;
    const total = this.quizQuestions.length;
    const body = this.dom.quizBody;

    if (this.quizCurrentIndex >= total) {
      const percentage = Math.round((this.quizScore / total) * 100);
      let statusText = 'Отличный результат! Вы подлинный знаток истории колледжа.';
      if (this.quizScore <= 2) {
        statusText = 'Рекомендуем подробнее ознакомиться с витринами в Зале 1 и Зале 2!';
      }

      body.innerHTML = `
        <div class="quiz-result-box">
          <div class="quiz-result-score-circle">${this.quizScore}/${total}</div>
          <h3 class="quiz-result-title">${percentage >= 80 ? 'Почётный краевед ЛДПК' : 'Экспозиция изучена!'}</h3>
          <p class="quiz-result-desc">${statusText}</p>
          <button type="button" id="quiz-restart-btn" class="quiz-next-btn">Пройти викторину снова</button>
        </div>
      `;

      body.querySelector('#quiz-restart-btn')?.addEventListener('click', () => {
        this.quizCurrentIndex = 0;
        this.quizScore = 0;
        this.renderQuizStep();
      });
      return;
    }

    const currentQ = this.quizQuestions[this.quizCurrentIndex];
    const progressPercent = ((this.quizCurrentIndex) / total) * 100;

    let optionsHtml = '';
    currentQ.options.forEach((optText, idx) => {
      optionsHtml += `<button type="button" class="quiz-option-btn" data-opt-idx="${idx}">${this.escapeHtml(optText)}</button>`;
    });

    body.innerHTML = `
      <div class="quiz-progress-bar-wrap">
        <div class="quiz-progress-fill" style="width: ${progressPercent}%;"></div>
      </div>
      <div class="quiz-question-number">Вопрос ${this.quizCurrentIndex + 1} из ${total}</div>
      <h3 class="quiz-question-text">${this.escapeHtml(currentQ.question)}</h3>
      <div class="quiz-options-list" id="quiz-options-list">
        ${optionsHtml}
      </div>
      <div id="quiz-feedback-box"></div>
      <button type="button" id="quiz-action-next" class="quiz-next-btn" style="display: none;">Следующий вопрос →</button>
    `;

    const optionsButtons = body.querySelectorAll('.quiz-option-btn');
    const feedbackBox = body.querySelector('#quiz-feedback-box');
    const nextBtn = body.querySelector('#quiz-action-next');

    optionsButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const selectedIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        const isCorrect = selectedIdx === currentQ.correct;

        optionsButtons.forEach((b) => { b.disabled = true; });

        if (isCorrect) {
          btn.classList.add('correct');
          this.quizScore++;
        } else {
          btn.classList.add('wrong');
          if (optionsButtons[currentQ.correct]) {
            optionsButtons[currentQ.correct].classList.add('correct');
          }
        }

        if (feedbackBox) {
          feedbackBox.innerHTML = `
            <div class="quiz-explanation-box">
              <strong>${isCorrect ? 'Верно!' : 'Историческая справка:'}</strong> ${this.escapeHtml(currentQ.explanation)}
            </div>
          `;
        }

        if (nextBtn) nextBtn.style.display = 'block';
      });
    });

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.quizCurrentIndex++;
        this.renderQuizStep();
      });
    }
  }

  /* ==========================================================================
     МЕТОДЫ ИНТЕРАКТИВНОЙ КАРТЫ ЗДАНИЯ
     ========================================================================== */
  getHallRoomBounds(hallId) {
    const bounds = {
      'college-history': { x: 20, y: 20, w: 380, h: 230 },
      'achievements':    { x: 20, y: 260, w: 155, h: 520 },
      'region-history':  { x: 185, y: 260, w: 215, h: 280 },
      'military-glory':  { x: 185, y: 550, w: 215, h: 230 }
    };
    return bounds[hallId] || { x: 20, y: 20, w: 380, h: 230 };
  }

  toggleMap() {
    if (this.isMapOpen) {
      this.closeMap();
    } else {
      this.openMap();
    }
  }

  openMap() {
    this.isMapOpen = true;

    // Синхронизация свежих данных из localStorage
    const freshCache = localStorage.getItem('museum_exhibits_data');
    if (freshCache) {
      try { this.data = JSON.parse(freshCache); } catch(e) {}
    }

    this.updateSvgMapVisuals();
    this.renderMapVitrineNodes();
    if (this.dom.mapBackdrop) this.dom.mapBackdrop.classList.add('active');
    if (this.dom.mapModal) this.dom.mapModal.classList.add('active');
    if (this.dom.btnOpenMap) this.dom.btnOpenMap.classList.add('active');
  }

  closeMap() {
    this.isMapOpen = false;
    if (this.dom.mapModal) this.dom.mapModal.classList.remove('active');
    if (this.dom.mapBackdrop) this.dom.mapBackdrop.classList.remove('active');
    if (this.dom.btnOpenMap) this.dom.btnOpenMap.classList.remove('active');
  }

  updateSvgMapVisuals() {
    if (!this.currentHall) return;

    document.querySelectorAll('.map-hall-group').forEach((g) => g.classList.remove('active'));
    document.querySelectorAll('.user-beacon-slot').forEach((slot) => { slot.innerHTML = ''; });

    const activeGroup = document.getElementById(`map-hall-${this.currentHall.id}`);
    if (activeGroup) {
      activeGroup.classList.add('active');
    }

    const beaconSlot = document.getElementById(`beacon-${this.currentHall.id}`);
    if (beaconSlot) {
      beaconSlot.innerHTML = `
        <circle cx="0" cy="0" r="10" class="beacon-pulse-ring"/>
        <circle cx="0" cy="0" r="5" class="beacon-center-dot"/>
        <text x="14" y="4" class="beacon-text">ВЫ ЗДЕСЬ</text>
      `;
    }
  }

  renderMapVitrineNodes() {
    if (!this.dom.mapNodesLayer) return;
    const layer = this.dom.mapNodesLayer;
    layer.innerHTML = '';

    const allHalls = this.data.halls || [];
    allHalls.forEach((hall) => {
      const b = this.getHallRoomBounds(hall.id);
      const spots = hall.hotspots || [];

      spots.forEach((spot, idx) => {
        let nodeX = b.x + (spot.mapX !== undefined ? (spot.mapX * b.w / 100) : (spot.x * b.w / 100));
        let nodeY = b.y + (spot.mapY !== undefined ? (spot.mapY * b.h / 100) : (spot.y * b.h / 100));

        nodeX = Math.max(b.x + 22, Math.min(b.x + b.w - 22, nodeX));
        nodeY = Math.max(b.y + 40, Math.min(b.y + b.h - 22, nodeY));

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'map-vitrine-node');
        g.setAttribute('transform', `translate(${nodeX.toFixed(1)}, ${nodeY.toFixed(1)})`);

        g.innerHTML = `
          <circle r="11" class="vitrine-node-circle"></circle>
          <text y="4" class="vitrine-node-idx" text-anchor="middle">${idx + 1}</text>
          <text y="22" class="vitrine-node-title" text-anchor="middle">${this.escapeHtml(spot.title)}</text>
        `;

        g.addEventListener('click', (e) => {
          e.stopPropagation();
          this.teleportToVitrine(hall.id, spot.id);
        });

        layer.appendChild(g);
      });
    });
  }

  async teleportToVitrine(hallId, vitrineId) {
    this.closeMap();
    if (this.currentHall?.id !== hallId) {
      await this.switchHall(hallId, vitrineId);
    } else {
      const spot = this.currentHall.hotspots?.find((s) => s.id === vitrineId);
      if (spot) {
        this.openVitrineDrawer(spot);
      }
    }
  }

  /* ==========================================================================
     ЯДРО ЭКСПОЗИЦИИ И СИНТЕЗАТОР РЕЧИ
     ========================================================================== */
  initSpeechSynth() {
    if (!('speechSynthesis' in window)) {
      if (this.dom.audioBtn) this.dom.audioBtn.style.display = 'none';
      return;
    }

    const loadVoices = () => {
      this.availableVoices = window.speechSynthesis.getVoices();
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  async loadExhibitsData(url) {
    this.setStatus('Загрузка базы...', true);

    const cachedData = localStorage.getItem('museum_exhibits_data');
    if (cachedData) {
      try {
        this.data = JSON.parse(cachedData);
        this.renderNavigation();
        this.renderMapVitrineNodes();
        await this.switchHall(this.data.halls[0].id);
        this.setStatus('Онлайн', false);
        return;
      } catch (err) {
        console.warn('Ошибка чтения кэша, запрашиваем файл...');
      }
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Файл не найден (HTTP ${response.status})`);
      }
      this.data = await response.json();

      if (!this.data.halls || this.data.halls.length === 0) {
        throw new Error('Пустой список залов');
      }
    } catch (error) {
      console.warn('[MuseumApp]: Применен резервный набор залов.');
      this.data = this.getEmbeddedFallbackData();
    }

    this.renderNavigation();
    this.renderMapVitrineNodes();
    await this.switchHall(this.data.halls[0].id);
    this.setStatus('Онлайн', false);
  }

  renderNavigation() {
    if (!this.dom.nav) return;
    this.dom.nav.innerHTML = '<div class="nav-active-pill" id="nav-pill"></div>';
    this.dom.navPill = document.getElementById('nav-pill');

    (this.data.halls || []).forEach((hall) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-item-btn';
      button.id = `nav-hall-${hall.id}`;
      button.textContent = hall.name;
      button.addEventListener('click', () => {
        if (!this.isTransitioning && this.currentHall?.id !== hall.id) {
          this.switchHall(hall.id);
        }
      });
      this.dom.nav.appendChild(button);
    });
  }

  positionPill(buttonElement) {
    if (!buttonElement || !this.dom.navPill) return;
    const left = buttonElement.offsetLeft;
    const width = buttonElement.offsetWidth;
    this.dom.navPill.style.width = `${width}px`;
    this.dom.navPill.style.transform = `translateX(${left}px)`;
    this.dom.navPill.style.opacity = '1';
  }

  async switchHall(hallId, targetVitrineId = null) {
    const targetHall = this.data.halls.find((h) => h.id === hallId);
    if (!targetHall || this.isTransitioning) return;

    this.isTransitioning = true;
    this.setStatus('Перемещение...', true);
    this.closeDrawer();
    this.updateNavButtons(hallId);

    if (this.dom.hotspotsLayer) this.dom.hotspotsLayer.classList.add('hidden');
    await this.delay(200);

    const video = this.dom.video;
    const bg = this.dom.bgLayer;

    if (this.dom.loader) this.dom.loader.classList.add('visible');

    const executeStaticFallback = () => {
      if (video) video.style.opacity = '0';
      if (bg && targetHall.bgImage) {
        bg.style.backgroundImage = `url('${targetHall.bgImage}')`;
        bg.classList.add('active');
      }
      if (this.dom.loader) this.dom.loader.classList.remove('visible');
      this.finishHallTransition(targetHall, targetVitrineId);
    };

    if (this.isLiteMode) {
      executeStaticFallback();
      return;
    }

    if (video && targetHall.videoTransition) {
      video.src = targetHall.videoTransition;
      video.load();

      let transitionFinished = false;

      const onVideoEnd = () => {
        if (transitionFinished) return;
        transitionFinished = true;

        video.pause();
        if (bg && targetHall.bgImage) {
          bg.style.backgroundImage = `url('${targetHall.bgImage}')`;
          bg.classList.add('active');
          video.style.opacity = '0';
        }

        if (this.dom.loader) this.dom.loader.classList.remove('visible');
        this.finishHallTransition(targetHall, targetVitrineId);
      };

      video.oncanplay = () => {
        if (this.dom.loader) this.dom.loader.classList.remove('visible');
        if (bg) bg.classList.remove('active');
        video.style.opacity = '1';
        video.play().catch(() => executeStaticFallback());
      };

      video.onended = onVideoEnd;
      video.onerror = () => executeStaticFallback();
    } else {
      executeStaticFallback();
    }
  }

  finishHallTransition(hall, targetVitrineId = null) {
    this.currentHall = hall;
    this.renderHotspots(hall.hotspots || []);
    this.updateSvgMapVisuals();
    this.renderMapVitrineNodes();

    setTimeout(() => {
      if (this.dom.hotspotsLayer) this.dom.hotspotsLayer.classList.remove('hidden');
      this.isTransitioning = false;
      this.setStatus('Онлайн', false);

      if (targetVitrineId) {
        const spot = hall.hotspots?.find((s) => s.id === targetVitrineId);
        if (spot) {
          this.openVitrineDrawer(spot);
        }
      }
    }, 150);
  }

  renderHotspots(hotspots) {
    if (!this.dom.hotspotsLayer) return;
    this.dom.hotspotsLayer.innerHTML = '';

    hotspots.forEach((spot) => {
      const marker = document.createElement('button');
      marker.className = 'hotspot-marker';
      marker.style.left = `${spot.x}%`;
      marker.style.top = `${spot.y}%`;
      marker.setAttribute('aria-label', spot.title);

      marker.innerHTML = `
        <div class="hotspot-beacon">
          <div class="ripple-ring"></div>
          <div class="core-dot"></div>
        </div>
        <div class="hotspot-tooltip">${this.escapeHtml(spot.title)}</div>
      `;

      marker.addEventListener('click', () => this.openVitrineDrawer(spot));
      this.dom.hotspotsLayer.appendChild(marker);
    });
  }

  openVitrineDrawer(spot) {
    this.stopAudio();
    this.currentSpot = spot;
    this.currentImageIndex = 0;

    if (this.dom.drawerTitle) this.dom.drawerTitle.textContent = spot.title;
    if (this.dom.drawerEpoch) this.dom.drawerEpoch.textContent = spot.epoch || '';
    if (this.dom.drawerDesc) this.dom.drawerDesc.textContent = spot.description || '';

    this.renderExtraInfo(spot.extraInfo || []);

    const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');
    const hasImages = Boolean(spot.images && spot.images.length > 0);

    if (this.dom.mediaModeToggle) {
      if (has3D && hasImages) {
        this.dom.mediaModeToggle.classList.remove('hidden');
        this.setMediaMode('3d');
      } else if (has3D) {
        this.dom.mediaModeToggle.classList.add('hidden');
        this.setMediaMode('3d');
      } else {
        this.dom.mediaModeToggle.classList.add('hidden');
        this.setMediaMode('gallery');
      }
    }

    if (has3D && this.dom.modelViewer) {
      this.dom.modelViewer.src = spot.model3d;
      this.dom.modelViewer.setAttribute('camera-controls', '');
      this.dom.modelViewer.setAttribute('auto-rotate', '');
      this.dom.modelViewer.setAttribute('reveal', 'auto');
      if (typeof this.dom.modelViewer.play === 'function') {
        this.dom.modelViewer.play();
      }
    }

    this.renderGallery();

    this.activeAudioText = spot.audioText || spot.description;
    if (this.dom.drawerBackdrop) this.dom.drawerBackdrop.classList.add('active');
    if (this.dom.drawer) {
      this.dom.drawer.classList.add('active');
      this.dom.drawer.setAttribute('aria-hidden', 'false');
    }
  }

  setMediaMode(mode) {
    if (mode === '3d') {
      if (this.dom.btnMode3D) this.dom.btnMode3D.classList.add('active');
      if (this.dom.btnModeGallery) this.dom.btnModeGallery.classList.remove('active');
      if (this.dom.modelWrapper) this.dom.modelWrapper.classList.remove('hidden');
      if (this.dom.galleryWrapper) this.dom.galleryWrapper.classList.add('hidden');
      if (this.dom.modelViewer) {
        this.dom.modelViewer.setAttribute('camera-controls', '');
        this.dom.modelViewer.setAttribute('auto-rotate', '');
      }
    } else {
      if (this.dom.btnModeGallery) this.dom.btnModeGallery.classList.add('active');
      if (this.dom.btnMode3D) this.dom.btnMode3D.classList.remove('active');
      if (this.dom.galleryWrapper) this.dom.galleryWrapper.classList.remove('hidden');
      if (this.dom.modelWrapper) this.dom.modelWrapper.classList.add('hidden');
    }
  }

  renderExtraInfo(extraInfoList) {
    if (!this.dom.drawerExtraInfo) return;
    this.dom.drawerExtraInfo.innerHTML = '';
    if (!extraInfoList || extraInfoList.length === 0) return;

    extraInfoList.forEach((item) => {
      const tag = document.createElement('div');
      tag.className = 'extra-info-tag';
      tag.innerHTML = `<span>${this.escapeHtml(item.label)}:</span> <strong>${this.escapeHtml(item.value)}</strong>`;
      this.dom.drawerExtraInfo.appendChild(tag);
    });
  }

  renderGallery() {
    if (!this.dom.galleryImg) return;
    const images = this.currentSpot?.images || [];
    if (images.length === 0) {
      this.dom.galleryImg.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23121218%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23666%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3E%D0%9D%D0%B5%D1%82%20%D1%84%D0%BE%D1%82%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D0%B9%3C%2Ftext%3E%3C%2Fsvg%3E';
      if (this.dom.galleryCaption) this.dom.galleryCaption.textContent = '';
      if (this.dom.galleryCounter) this.dom.galleryCounter.textContent = '0 / 0';
      if (this.dom.galleryPrev) this.dom.galleryPrev.style.display = 'none';
      if (this.dom.galleryNext) this.dom.galleryNext.style.display = 'none';
      if (this.dom.galleryDots) this.dom.galleryDots.innerHTML = '';
      return;
    }

    const current = images[this.currentImageIndex];
    this.dom.galleryImg.onerror = () => {
      this.dom.galleryImg.src = 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80';
    };
    this.dom.galleryImg.src = current.url;
    if (this.dom.galleryCaption) this.dom.galleryCaption.textContent = current.caption || '';
    if (this.dom.galleryCounter) this.dom.galleryCounter.textContent = `${this.currentImageIndex + 1} / ${images.length}`;

    const showControls = images.length > 1;
    if (this.dom.galleryPrev) this.dom.galleryPrev.style.display = showControls ? 'flex' : 'none';
    if (this.dom.galleryNext) this.dom.galleryNext.style.display = showControls ? 'flex' : 'none';

    if (this.dom.galleryDots) {
      this.dom.galleryDots.innerHTML = '';
      if (showControls) {
        images.forEach((_, idx) => {
          const dot = document.createElement('div');
          dot.className = `gallery-dot ${idx === this.currentImageIndex ? 'active' : ''}`;
          dot.addEventListener('click', () => {
            this.currentImageIndex = idx;
            this.renderGallery();
          });
          this.dom.galleryDots.appendChild(dot);
        });
      }
    }
  }

  nextImage() {
    const images = this.currentSpot?.images || [];
    if (images.length <= 1) return;
    this.currentImageIndex = (this.currentImageIndex + 1) % images.length;
    this.renderGallery();
  }

  prevImage() {
    const images = this.currentSpot?.images || [];
    if (images.length <= 1) return;
    this.currentImageIndex = (this.currentImageIndex - 1 + images.length) % images.length;
    this.renderGallery();
  }

  closeDrawer() {
    this.stopAudio();
    if (this.dom.drawer) this.dom.drawer.classList.remove('active');
    if (this.dom.drawerBackdrop) this.dom.drawerBackdrop.classList.remove('active');
    if (this.dom.drawer) this.dom.drawer.setAttribute('aria-hidden', 'true');

    if (this.dom.modelViewer) {
      this.dom.modelViewer.removeAttribute('auto-rotate');
      if (typeof this.dom.modelViewer.pause === 'function') {
        this.dom.modelViewer.pause();
      }
    }
  }

  toggleAudioguide() {
    if (!('speechSynthesis' in window)) return;
    if (this.isAudioPlaying) {
      this.stopAudio();
    } else {
      this.playAudio(this.activeAudioText);
    }
  }

  playAudio(text) {
    if (!text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.95;

    const ruVoice = this.availableVoices.find((v) => v.lang.includes('ru') || v.lang.includes('RU'));
    if (ruVoice) utterance.voice = ruVoice;

    utterance.onstart = () => {
      this.isAudioPlaying = true;
      if (this.dom.audioBtn) this.dom.audioBtn.classList.add('playing');
      if (this.dom.audioBtnLabel) this.dom.audioBtnLabel.textContent = 'Остановить экскурсовода';
    };

    utterance.onend = () => this.resetAudioBtnState();
    utterance.onerror = () => this.resetAudioBtnState();

    this.currentSpeechUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stopAudio() {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    this.resetAudioBtnState();
  }

  resetAudioBtnState() {
    this.isAudioPlaying = false;
    if (this.dom.audioBtn) this.dom.audioBtn.classList.remove('playing');
    if (this.dom.audioBtnLabel) this.dom.audioBtnLabel.textContent = 'Слушать экскурсовода';
  }

  updateNavButtons(activeId) {
    if (!this.dom.nav) return;
    const buttons = this.dom.nav.querySelectorAll('.nav-item-btn');
    let targetButton = null;

    buttons.forEach((btn) => {
      const isMatch = btn.id === `nav-hall-${activeId}`;
      btn.classList.toggle('active', isMatch);
      if (isMatch) targetButton = btn;
    });

    if (targetButton) {
      requestAnimationFrame(() => this.positionPill(targetButton));
    }
  }

  setStatus(text, isLoading) {
    if (!this.dom.statusBadge) return;
    const statusTextEl = this.dom.statusBadge.querySelector('.status-text');
    if (statusTextEl) statusTextEl.textContent = text;
    this.dom.statusBadge.classList.toggle('loading', isLoading);
  }

  handleVideoError(error) {}

  escapeHtml(string) {
    const div = document.createElement('div');
    div.textContent = string || '';
    return div.innerHTML;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getEmbeddedFallbackData() {
    return {
      halls: [
        {
          id: "college-history",
          name: "История ЛДПК",
          bgImage: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1920&q=80",
          videoTransition: "assets/videos/to_hall1.mp4",
          hotspots: []
        }
      ]
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MuseumApp();
});