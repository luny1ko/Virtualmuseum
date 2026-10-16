// admin.js
/**
 * Панель управления контентом виртуального музея ЛДПК
 * Поддержка редактирования панорам залов и схемы здания,
 * динамическая расстановка и удаление витрин, экспорт exhibits.json.
 */
class MuseumAdmin {
  constructor() {
    this.data = { halls: [] };
    this.currentHallId = null;
    this.selectedVitrineId = null;
    this.toastTimeout = null;
    this.adminViewMode = 'hall'; // 'hall' (фото зала) или 'building-plan' (схема здания)

    this.dom = {
      fileInput: document.getElementById('json-file-input'),
      btnFetch: document.getElementById('btn-fetch-current'),
      btnExport: document.getElementById('btn-export-json'),
      
      // Переключатель режимов холста
      viewModeSelect: document.getElementById('admin-view-mode'),
      hallSelect: document.getElementById('hall-select'),
      hallSelectLabel: document.getElementById('hall-select-label'),
      canvasHint: document.getElementById('canvas-hint'),

      // Холст фото зала
      viewport: document.getElementById('canvas-viewport'),
      hallImg: document.getElementById('hall-canvas-img'),
      markersLayer: document.getElementById('canvas-markers-layer'),

      // Холст схемы здания
      planWrapper: document.getElementById('admin-plan-wrapper'),
      adminSvgMap: document.getElementById('admin-svg-map'),
      planMarkersLayer: document.getElementById('admin-plan-markers-layer'),

      // Правая панель редактора витрины
      chipsBox: document.getElementById('vitrines-chips'),
      editorHeading: document.getElementById('editor-heading'),
      btnNewVitrine: document.getElementById('btn-new-vitrine'),
      form: document.getElementById('vitrine-form'),
      formId: document.getElementById('form-vitrine-id'),
      formX: document.getElementById('form-x'),
      formY: document.getElementById('form-y'),
      formTitle: document.getElementById('form-title'),
      formEpoch: document.getElementById('form-epoch'),
      formModel3d: document.getElementById('form-model3d'),
      formDesc: document.getElementById('form-desc'),
      formAudio: document.getElementById('form-audio'),
      imagesContainer: document.getElementById('images-container'),
      btnAddImage: document.getElementById('btn-add-image'),
      btnDeleteVitrine: document.getElementById('btn-delete-vitrine'),

      // Toast-уведомления
      toast: document.getElementById('admin-toast'),
      toastIcon: document.getElementById('toast-icon'),
      toastMessage: document.getElementById('toast-message')
    };

    this.init();
  }

  async init() {
    this.bindEvents();

    const cached = localStorage.getItem('museum_exhibits_data');
    if (cached) {
      try {
        this.data = JSON.parse(cached);
        this.populateHallSelect();
        return;
      } catch (e) {
        console.warn('Ошибка чтения кэша, запрашиваем файл exhibits.json...');
      }
    }
    await this.fetchDefaultData();
  }

  bindEvents() {
    this.dom.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    this.dom.btnFetch.addEventListener('click', async () => {
      localStorage.removeItem('museum_exhibits_data');
      await this.fetchDefaultData();
      this.showToast('База сброшена до исходного exhibits.json', 'info');
    });

    this.dom.btnExport.addEventListener('click', () => this.exportJsonFile());

    this.dom.hallSelect.addEventListener('change', () => {
      this.currentHallId = this.dom.hallSelect.value;
      this.renderHallCanvas();
    });

    // Переключение между холстом фото зала и схемой здания
    if (this.dom.viewModeSelect) {
      this.dom.viewModeSelect.addEventListener('change', () => {
        this.adminViewMode = this.dom.viewModeSelect.value;
        const isPlan = this.adminViewMode === 'building-plan';

        if (this.dom.planWrapper) this.dom.planWrapper.classList.toggle('hidden', !isPlan);
        if (this.dom.hallImg) this.dom.hallImg.classList.toggle('hidden', isPlan);
        if (this.dom.markersLayer) this.dom.markersLayer.classList.toggle('hidden', isPlan);
        if (this.dom.hallSelect) this.dom.hallSelect.classList.toggle('hidden', isPlan);
        if (this.dom.hallSelectLabel) this.dom.hallSelectLabel.classList.toggle('hidden', isPlan);

        if (isPlan) {
          if (this.dom.canvasHint) this.dom.canvasHint.textContent = 'Кликните по любой комнате схемы, чтобы переместить стенд';
          this.renderAdminPlanMarkers();
        } else {
          if (this.dom.canvasHint) this.dom.canvasHint.textContent = 'Кликните по фото зала, чтобы установить координаты витрины';
          this.renderHallCanvas();
        }
      });
    }

    // Клик по холсту панорамы зала
    this.dom.viewport.addEventListener('click', (e) => {
      if (this.adminViewMode === 'hall') {
        this.handleCanvasClick(e);
      }
    });

    // Клик по схеме здания
    if (this.dom.adminSvgMap) {
      this.dom.adminSvgMap.addEventListener('click', (e) => this.handlePlanCanvasClick(e));
    }

    this.dom.btnNewVitrine.addEventListener('click', () => this.createNewVitrine());
    this.dom.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    this.dom.btnDeleteVitrine.addEventListener('click', () => this.deleteCurrentVitrine());
    this.dom.btnAddImage.addEventListener('click', () => this.addImageRow('', ''));
  }

  showToast(message, type = 'success') {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.dom.toast.className = `admin-toast active ${type}`;
    this.dom.toastMessage.textContent = message;

    if (type === 'success') {
      this.dom.toastIcon.textContent = '✓';
    } else if (type === 'error') {
      this.dom.toastIcon.textContent = '✕';
    } else {
      this.dom.toastIcon.textContent = 'ℹ';
    }

    this.toastTimeout = setTimeout(() => {
      this.dom.toast.classList.remove('active');
    }, 3200);
  }

  async fetchDefaultData() {
    try {
      const response = await fetch('exhibits.json');
      if (!response.ok) throw new Error('exhibits.json не найден');
      this.data = await response.json();
      this.populateHallSelect();
    } catch (err) {
      this.showToast('Выберите exhibits.json вручную через "📂 Открыть"', 'info');
    }
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this.data = JSON.parse(e.target.result);
        this.persistData();
        this.populateHallSelect();
        this.showToast('Файл успешно загружен и сохранён', 'success');
      } catch (err) {
        this.showToast('Ошибка синтаксиса в выбранном JSON файле', 'error');
      }
    };
    reader.readAsText(file);
  }

  persistData() {
    localStorage.setItem('museum_exhibits_data', JSON.stringify(this.data));
  }

  populateHallSelect() {
    if (!this.data.halls || this.data.halls.length === 0) return;
    this.dom.hallSelect.innerHTML = '';

    this.data.halls.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name;
      this.dom.hallSelect.appendChild(opt);
    });

    this.currentHallId = this.data.halls[0].id;
    this.renderHallCanvas();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
  }

  getCurrentHall() {
    return this.data.halls.find((h) => h.id === this.currentHallId);
  }

  renderHallCanvas() {
    const hall = this.getCurrentHall();
    if (!hall) return;

    this.dom.hallImg.src = hall.bgImage || '';
    this.renderMarkersAndChips();
  }

  renderMarkersAndChips() {
    const hall = this.getCurrentHall();
    this.dom.markersLayer.innerHTML = '';
    this.dom.chipsBox.innerHTML = '';

    const vitrines = hall?.hotspots || [];

    vitrines.forEach((v, index) => {
      const marker = document.createElement('div');
      marker.className = `canvas-marker ${v.id === this.selectedVitrineId ? 'active' : ''}`;
      marker.style.left = `${v.x}%`;
      marker.style.top = `${v.y}%`;
      marker.textContent = index + 1;
      marker.title = v.title;
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectVitrine(v.id);
      });
      this.dom.markersLayer.appendChild(marker);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `vitrine-chip ${v.id === this.selectedVitrineId ? 'active' : ''}`;
      chip.textContent = `${index + 1}. ${v.title || 'Без названия'}`;
      chip.addEventListener('click', () => this.selectVitrine(v.id));
      this.dom.chipsBox.appendChild(chip);
    });

    if (vitrines.length > 0 && !this.selectedVitrineId) {
      this.selectVitrine(vitrines[0].id);
    }
  }

  selectVitrine(vitrineId) {
    this.selectedVitrineId = vitrineId;
    let vitrine = null;

    // Поиск витрины по всем залам
    (this.data.halls || []).forEach((h) => {
      const found = h.hotspots?.find((v) => v.id === vitrineId);
      if (found) {
        vitrine = found;
        if (this.currentHallId !== h.id) {
          this.currentHallId = h.id;
          this.dom.hallSelect.value = h.id;
          if (this.adminViewMode === 'hall') {
            this.dom.hallImg.src = h.bgImage || '';
          }
        }
      }
    });

    if (!vitrine) return;

    this.dom.editorHeading.textContent = `Редактирование: ${vitrine.title}`;
    this.dom.formId.value = vitrine.id;
    this.dom.formX.value = vitrine.x !== undefined ? vitrine.x : 50.0;
    this.dom.formY.value = vitrine.y !== undefined ? vitrine.y : 50.0;
    this.dom.formTitle.value = vitrine.title || '';
    this.dom.formEpoch.value = vitrine.epoch || '';
    this.dom.formModel3d.value = vitrine.model3d || '';
    this.dom.formDesc.value = vitrine.description || '';
    this.dom.formAudio.value = vitrine.audioText || '';

    this.dom.imagesContainer.innerHTML = '';
    (vitrine.images || []).forEach((img) => {
      this.addImageRow(img.url, img.caption);
    });

    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
  }

  createNewVitrine() {
    const hall = this.getCurrentHall() || this.data.halls[0];
    if (!hall) return;

    const newId = `vitrine-${Date.now().toString().slice(-4)}`;
    this.selectedVitrineId = newId;

    this.dom.editorHeading.textContent = 'Новая витрина';
    this.dom.formId.value = newId;
    this.dom.formX.value = 50.0;
    this.dom.formY.value = 50.0;
    this.dom.formTitle.value = 'Новая витрина';
    this.dom.formEpoch.value = '';
    this.dom.formModel3d.value = '';
    this.dom.formDesc.value = '';
    this.dom.formAudio.value = '';
    this.dom.imagesContainer.innerHTML = '';
    this.addImageRow('', '');

    if (!hall.hotspots) hall.hotspots = [];
    hall.hotspots.push({
      id: newId,
      x: 50.0,
      y: 50.0,
      mapX: 50.0,
      mapY: 50.0,
      title: 'Новая витрина',
      epoch: '',
      model3d: '',
      description: '',
      audioText: '',
      images: [],
      extraInfo: []
    });

    this.persistData();
    this.showToast('Кликните по фото или схеме, чтобы задать положение витрины', 'info');
    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
  }

  handleCanvasClick(event) {
    const rect = this.dom.viewport.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const yPx = event.clientY - rect.top;

    const xPercent = Number(((xPx / rect.width) * 100).toFixed(1));
    const yPercent = Number(((yPx / rect.height) * 100).toFixed(1));

    this.dom.formX.value = xPercent;
    this.dom.formY.value = yPercent;

    if (this.selectedVitrineId) {
      const hall = this.getCurrentHall();
      const vitrine = hall?.hotspots?.find((v) => v.id === this.selectedVitrineId);
      if (vitrine) {
        vitrine.x = xPercent;
        vitrine.y = yPercent;
        this.persistData();
        this.renderMarkersAndChips();
      }
    }
  }

  /* ==========================================================================
     ЛОГИКА РАБОТЫ СО СХЕМОЙ ЗДАНИЯ (АРХИТЕКТУРНЫЙ ПЛАН)
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

  renderAdminPlanMarkers() {
    if (!this.dom.planMarkersLayer) return;
    const layer = this.dom.planMarkersLayer;
    layer.innerHTML = '';

    (this.data.halls || []).forEach((hall) => {
      const b = this.getHallRoomBounds(hall.id);
      (hall.hotspots || []).forEach((spot, idx) => {
        let nodeX = b.x + (spot.mapX !== undefined ? (spot.mapX * b.w / 100) : (spot.x * b.w / 100));
        let nodeY = b.y + (spot.mapY !== undefined ? (spot.mapY * b.h / 100) : (spot.y * b.h / 100));

        nodeX = Math.max(b.x + 16, Math.min(b.x + b.w - 16, nodeX));
        nodeY = Math.max(b.y + 24, Math.min(b.y + b.h - 16, nodeY));

        const isSelected = spot.id === this.selectedVitrineId;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `canvas-plan-node ${isSelected ? 'active' : ''}`);
        g.setAttribute('transform', `translate(${nodeX.toFixed(1)}, ${nodeY.toFixed(1)})`);
        g.style.cursor = 'pointer';

        g.innerHTML = `
          <circle r="13" fill="${isSelected ? '#f59e0b' : '#38bdf8'}" stroke="#ffffff" stroke-width="2"></circle>
          <text y="4" fill="#000000" font-size="10" font-weight="700" text-anchor="middle">${idx + 1}</text>
          <text y="24" fill="#ffffff" font-size="9" text-anchor="middle" font-weight="600">${spot.title || ''}</text>
        `;

        g.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentHallId = hall.id;
          this.dom.hallSelect.value = hall.id;
          this.selectVitrine(spot.id);
          this.renderAdminPlanMarkers();
        });

        layer.appendChild(g);
      });
    });
  }

  handlePlanCanvasClick(e) {
    if (!this.selectedVitrineId || !this.dom.adminSvgMap) return;

    const svg = this.dom.adminSvgMap;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    // Определение зала по координатам клика
    let clickedHallId = null;
    const hallBounds = ['college-history', 'achievements', 'region-history', 'military-glory'];
    for (const hid of hallBounds) {
      const b = this.getHallRoomBounds(hid);
      if (svgP.x >= b.x && svgP.x <= b.x + b.w && svgP.y >= b.y && svgP.y <= b.y + b.h) {
        clickedHallId = hid;
        break;
      }
    }

    if (!clickedHallId) return;

    const b = this.getHallRoomBounds(clickedHallId);
    const relX = Number((((svgP.x - b.x) / b.w) * 100).toFixed(1));
    const relY = Number((((svgP.y - b.y) / b.h) * 100).toFixed(1));

    let vitrine = null;
    let oldHall = null;
    (this.data.halls || []).forEach((h) => {
      const found = h.hotspots?.find((v) => v.id === this.selectedVitrineId);
      if (found) { vitrine = found; oldHall = h; }
    });

    if (!vitrine) return;

    vitrine.mapX = Math.max(5, Math.min(95, relX));
    vitrine.mapY = Math.max(8, Math.min(92, relY));

    // Если витрину переместили в другую комнату
    if (oldHall && oldHall.id !== clickedHallId) {
      oldHall.hotspots = oldHall.hotspots.filter((v) => v.id !== vitrine.id);
      const targetHall = this.data.halls.find((h) => h.id === clickedHallId);
      if (targetHall) {
        if (!targetHall.hotspots) targetHall.hotspots = [];
        targetHall.hotspots.push(vitrine);
      }
      this.currentHallId = clickedHallId;
      this.dom.hallSelect.value = clickedHallId;
    }

    this.persistData();
    this.renderAdminPlanMarkers();
    this.renderMarkersAndChips();
    this.showToast('Положение витрины на плане здания сохранено', 'success');
  }

  addImageRow(url = '', caption = '') {
    const row = document.createElement('div');
    row.className = 'dynamic-image-row';
    row.innerHTML = `
      <div class="image-row-inputs">
        <input type="text" class="form-input img-url-input" placeholder="Путь к фото (assets/images/...) или URL" value="${url}" style="flex: 2;">
        <button type="button" class="btn btn-xs btn-danger btn-remove-img">&times;</button>
      </div>
      <input type="text" class="form-input img-caption-input" placeholder="Подпись к фото" value="${caption}">
    `;

    row.querySelector('.btn-remove-img').addEventListener('click', () => row.remove());
    this.dom.imagesContainer.appendChild(row);
  }

  handleFormSubmit(e) {
    e.preventDefault();
    const hall = this.getCurrentHall();
    if (!hall) return;

    if (!hall.hotspots) hall.hotspots = [];

    const id = this.dom.formId.value;
    const x = parseFloat(this.dom.formX.value);
    const y = parseFloat(this.dom.formY.value);
    const title = this.dom.formTitle.value.trim();
    const epoch = this.dom.formEpoch.value.trim();
    const model3d = this.dom.formModel3d.value.trim();
    const description = this.dom.formDesc.value.trim();
    const audioText = this.dom.formAudio.value.trim();

    const images = [];
    const rows = this.dom.imagesContainer.querySelectorAll('.dynamic-image-row');
    rows.forEach((r) => {
      const url = r.querySelector('.img-url-input').value.trim();
      const caption = r.querySelector('.img-caption-input').value.trim();
      if (url) {
        images.push({ url, caption });
      }
    });

    let existing = hall.hotspots.find((v) => v.id === id);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.title = title;
      existing.epoch = epoch;
      existing.model3d = model3d;
      existing.description = description;
      existing.audioText = audioText;
      existing.images = images;
    } else {
      hall.hotspots.push({
        id,
        x,
        y,
        mapX: 50.0,
        mapY: 50.0,
        title,
        epoch,
        model3d,
        description,
        audioText,
        images,
        extraInfo: []
      });
    }

    this.selectedVitrineId = id;
    this.persistData();
    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
    this.showToast('✅ Витрина сохранена и обновлена в музее', 'success');
  }

  deleteCurrentVitrine() {
    if (!this.selectedVitrineId) return;
    const hall = this.getCurrentHall();
    if (!hall || !hall.hotspots) return;

    hall.hotspots = hall.hotspots.filter((v) => v.id !== this.selectedVitrineId);
    this.selectedVitrineId = hall.hotspots[0]?.id || null;
    
    this.persistData();
    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
    this.showToast('Витрина удалена из экспозиции и со схемы здания', 'info');
  }

  exportJsonFile() {
    const jsonString = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'exhibits.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Файл exhibits.json сформирован и скачан', 'success');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MuseumAdmin();
});