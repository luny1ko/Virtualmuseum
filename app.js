// app.js
/**
 * Архитектурный класс "Виртуальный музей ЛДПК"
 * Включает: векторный интерактивный план залов (Floor Plan), тумблер Lite Mode (экономия GPU),
 * безопасное управление 3D-моделями без сброса WebGL-контекста, аудиогид и сквозной переход к стендам.
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

    this.dom = {
      nav: document.getElementById('hall-nav'),
      navPill: document.getElementById('nav-pill'),
      video: document.getElementById('hall-video'),
      bgLayer: document.getElementById('hall-bg'),
      hotspotsLayer: document.getElementById('hotspots-layer'),
      statusBadge: document.getElementById('system-status'),
      loader: document.getElementById('transition-loader'),
      
      // Кнопки шапки
      btnOpenMap: document.getElementById('btn-open-map'),
      btnToggleLite: document.getElementById('btn-toggle-lite'),
      liteBtnText: document.getElementById('lite-btn-text'),

      // Интерактивная мини-карта залов
      mapModal: document.getElementById('map-modal'),
      mapBackdrop: document.getElementById('map-modal-backdrop'),
      mapCloseBtn: document.getElementById('map-close-btn'),
      svgMap: document.getElementById('museum-svg-map'),

      // Выдвижная информационная панель витрины (Drawer)
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

  /**
   * Инициализация облегчённого режима на основе сохранённых предпочтений
   */
  initLiteModeState() {
    const saved = localStorage.getItem('museum_lite_mode');
    this.isLiteMode = saved === 'true';
    this.applyLiteMode(this.isLiteMode);
  }

  applyLiteMode(active) {
    this.isLiteMode = active;
    document.body.classList.toggle('lite-mode', active);
    this.dom.btnToggleLite.classList.toggle('active', active);
    this.dom.liteBtnText.textContent = active ? 'Lite (Вкл)' : 'Lite';
    localStorage.setItem('museum_lite_mode', active.toString());
  }

  toggleLiteMode() {
    this.applyLiteMode(!this.isLiteMode);
  }

  bindEvents() {
    // Управление шторкой витрины (Drawer)
    this.dom.drawerCloseBtn.addEventListener('click', () => this.closeDrawer());
    this.dom.drawerBackdrop.addEventListener('click', () => this.closeDrawer());

    // Управление интерактивной картой
    this.dom.btnOpenMap.addEventListener('click', () => this.toggleMap());
    this.dom.mapCloseBtn.addEventListener('click', () => this.closeMap());
    this.dom.mapBackdrop.addEventListener('click', () => this.closeMap());

    // Переключение Lite Mode
    this.dom.btnToggleLite.addEventListener('click', () => this.toggleLiteMode());

    // Горячие клавиши (M - карта, Esc - закрытие, Стрелки - галерея)
    window.addEventListener('keydown', (event) => {
      if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
        const isEditing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        if (!isEditing) {
          event.preventDefault();
          this.toggleMap();
        }
      }

      if (event.key === 'Escape') {
        if (this.isMapOpen) {
          this.closeMap();
          return;
        }
        if (this.dom.drawer.classList.contains('active')) {
          this.closeDrawer();
        }
      }

      if (this.dom.drawer.classList.contains('active')) {
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

    this.dom.galleryPrev.addEventListener('click', () => this.prevImage());
    this.dom.galleryNext.addEventListener('click', () => this.nextImage());

    this.dom.btnMode3D.addEventListener('click', () => this.setMediaMode('3d'));
    this.dom.btnModeGallery.addEventListener('click', () => this.setMediaMode('gallery'));

    this.dom.audioBtn.addEventListener('click', () => this.toggleAudioguide());
    this.dom.video.addEventListener('error', (e) => this.handleVideoError(e));

    this.bindSvgMapEvents();
  }

  /**
   * Привязка кликов к векторным зонам залов и маркерам витрин на SVG-плане
   */
  bindSvgMapEvents() {
    const hallGroups = document.querySelectorAll('.map-hall-group');
    hallGroups.forEach((group) => {
      group.addEventListener('click', (e) => {
        // Если кликнули непосредственно по витрине внутри зала — не перебиваем обработку витрины
        if (e.target.closest('.map-vitrine-node')) return;
        const hallId = group.getAttribute('data-hall-id');
        if (hallId && hallId !== this.currentHall?.id) {
          this.closeMap();
          this.switchHall(hallId);
        }
      });
    });

    const vitrineNodes = document.querySelectorAll('.map-vitrine-node');
    vitrineNodes.forEach((node) => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const hallId = node.getAttribute('data-hall-id');
        const vitrineId = node.getAttribute('data-vitrine-id');
        this.teleportToVitrine(hallId, vitrineId);
      });
    });
  }

  /**
   * Сквозная телепортация: перелёт в зал и мгновенное открытие нужной витрины
   */
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

  toggleMap() {
    if (this.isMapOpen) {
      this.closeMap();
    } else {
      this.openMap();
    }
  }

  openMap() {
    this.isMapOpen = true;
    this.updateSvgMapVisuals();
    this.dom.mapBackdrop.classList.add('active');
    this.dom.mapModal.classList.add('active');
    this.dom.btnOpenMap.classList.add('active');
  }

  closeMap() {
    this.isMapOpen = false;
    this.dom.mapModal.classList.remove('active');
    this.dom.mapBackdrop.classList.remove('active');
    this.dom.btnOpenMap.classList.remove('active');
  }

  /**
   * Отрисовка геопозиции "Вы здесь" (радар) на карте залов
   */
  updateSvgMapVisuals() {
    if (!this.currentHall) return;

    // Сбрасываем активные залы
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

  initSpeechSynth() {
    if (!('speechSynthesis' in window)) {
      this.dom.audioBtn.style.display = 'none';
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
    await this.switchHall(this.data.halls[0].id);
    this.setStatus('Онлайн', false);
  }

  renderNavigation() {
    this.dom.nav.innerHTML = '<div class="nav-active-pill" id="nav-pill"></div>';
    this.dom.navPill = document.getElementById('nav-pill');

    this.data.halls.forEach((hall) => {
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

    this.dom.hotspotsLayer.classList.add('hidden');
    await this.delay(200);

    const video = this.dom.video;
    const bg = this.dom.bgLayer;

    this.dom.loader.classList.add('visible');

    const executeStaticFallback = () => {
      video.style.opacity = '0';
      if (targetHall.bgImage) {
        bg.style.backgroundImage = `url('${targetHall.bgImage}')`;
        bg.classList.add('active');
      }
      this.dom.loader.classList.remove('visible');
      this.finishHallTransition(targetHall, targetVitrineId);
    };

    // В облегчённом режиме (Lite Mode) видеопролёт пропускается для мгновенной отрисовки без нагрузки
    if (this.isLiteMode) {
      executeStaticFallback();
      return;
    }

    if (targetHall.videoTransition) {
      video.src = targetHall.videoTransition;
      video.load();

      let transitionFinished = false;

      const onVideoEnd = () => {
        if (transitionFinished) return;
        transitionFinished = true;

        video.pause();
        if (targetHall.bgImage) {
          bg.style.backgroundImage = `url('${targetHall.bgImage}')`;
          bg.classList.add('active');
          video.style.opacity = '0';
        }

        this.dom.loader.classList.remove('visible');
        this.finishHallTransition(targetHall, targetVitrineId);
      };

      video.oncanplay = () => {
        this.dom.loader.classList.remove('visible');
        bg.classList.remove('active');
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

    setTimeout(() => {
      this.dom.hotspotsLayer.classList.remove('hidden');
      this.isTransitioning = false;
      this.setStatus('Онлайн', false);

      // Если переход был вызван по ссылке на витрину из карты — открываем её
      if (targetVitrineId) {
        const spot = hall.hotspots?.find((s) => s.id === targetVitrineId);
        if (spot) {
          this.openVitrineDrawer(spot);
        }
      }
    }, 150);
  }

  renderHotspots(hotspots) {
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

    this.dom.drawerTitle.textContent = spot.title;
    this.dom.drawerEpoch.textContent = spot.epoch;
    this.dom.drawerDesc.textContent = spot.description;

    this.renderExtraInfo(spot.extraInfo || []);

    const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');
    const hasImages = Boolean(spot.images && spot.images.length > 0);

    // Управление тумблером режимов
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

    // Безотказный запуск 3D через model-viewer
    if (has3D) {
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
    this.dom.drawerBackdrop.classList.add('active');
    this.dom.drawer.classList.add('active');
    this.dom.drawer.setAttribute('aria-hidden', 'false');
  }

  setMediaMode(mode) {
    if (mode === '3d') {
      this.dom.btnMode3D.classList.add('active');
      this.dom.btnModeGallery.classList.remove('active');
      this.dom.modelWrapper.classList.remove('hidden');
      this.dom.galleryWrapper.classList.add('hidden');
      if (this.dom.modelViewer) {
        this.dom.modelViewer.setAttribute('camera-controls', '');
        this.dom.modelViewer.setAttribute('auto-rotate', '');
      }
    } else {
      this.dom.btnModeGallery.classList.add('active');
      this.dom.btnMode3D.classList.remove('active');
      this.dom.galleryWrapper.classList.remove('hidden');
      this.dom.modelWrapper.classList.add('hidden');
    }
  }

  renderExtraInfo(extraInfoList) {
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
    const images = this.currentSpot?.images || [];
    if (images.length === 0) {
      this.dom.galleryImg.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23121218%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23666%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3E%D0%9D%D0%B5%D1%82%20%D1%84%D0%BE%D1%82%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D0%B9%3C%2Ftext%3E%3C%2Fsvg%3E';
      this.dom.galleryCaption.textContent = '';
      this.dom.galleryCounter.textContent = '0 / 0';
      this.dom.galleryPrev.style.display = 'none';
      this.dom.galleryNext.style.display = 'none';
      this.dom.galleryDots.innerHTML = '';
      return;
    }

    const current = images[this.currentImageIndex];
    this.dom.galleryImg.onerror = () => {
      this.dom.galleryImg.src = 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80';
    };
    this.dom.galleryImg.src = current.url;
    this.dom.galleryCaption.textContent = current.caption || '';

    const showControls = images.length > 1;
    this.dom.galleryPrev.style.display = showControls ? 'flex' : 'none';
    this.dom.galleryNext.style.display = showControls ? 'flex' : 'none';

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
    this.dom.drawer.classList.remove('active');
    this.dom.drawerBackdrop.classList.remove('active');
    this.dom.drawer.setAttribute('aria-hidden', 'true');

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
      this.dom.audioBtn.classList.add('playing');
      this.dom.audioBtnLabel.textContent = 'Остановить экскурсовода';
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
    this.dom.audioBtn.classList.remove('playing');
    this.dom.audioBtnLabel.textContent = 'Слушать экскурсовода';
  }

  updateNavButtons(activeId) {
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
    const statusTextEl = this.dom.statusBadge.querySelector('.status-text');
    if (statusTextEl) statusTextEl.textContent = text;
    this.dom.statusBadge.classList.toggle('loading', isLoading);
  }

  handleVideoError() {}

  escapeHtml(string) {
    const div = document.createElement('div');
    div.textContent = string;
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
          bgImage: "assets/images/hall1_static.jpg",
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