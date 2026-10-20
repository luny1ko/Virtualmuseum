// admin.js — ПОНЯТНЫЙ РЕДАКТОР ЭКСПОЗИЦИИ МУЗЕЯ ЛДПК 2.0 (Полная сборка)
class MuseumStudioPro {
  constructor() {
    this.data = { halls: [] };
    this.currentHallId = null;
    this.selectedVitrineId = null;
    this.adminViewMode = 'hall'; // 'hall' | 'building-plan'
    this.isDraggingMarker = false;
    this.dragSrcRow = null;
    this.toastTimeout = null;
    this.pendingConfirmAction = null;

    this.dom = {
      fileInput: document.getElementById('json-file-input'),
      btnFetch: document.getElementById('btn-fetch-current'),
      btnExport: document.getElementById('btn-export-json'),
      btnLivePreview: document.getElementById('btn-live-preview'),

      viewModeSelect: document.getElementById('admin-view-mode'),
      hallSelectWrap: document.getElementById('hall-select-wrap'),
      hallSelect: document.getElementById('hall-select'),
      snapToggle: document.getElementById('snap-toggle'),

      // Холст и телеметрия
      hudModeName: document.getElementById('hud-mode-name'),
      hudCursorCoords: document.getElementById('hud-cursor-coords'),
      hudSelectedId: document.getElementById('hud-selected-id'),
      viewport: document.getElementById('canvas-viewport'),
      hallImg: document.getElementById('hall-canvas-img'),
      markersLayer: document.getElementById('canvas-markers-layer'),

      // План здания
      planWrapper: document.getElementById('admin-plan-wrapper'),
      adminSvgMap: document.getElementById('admin-svg-map'),
      planMarkersLayer: document.getElementById('admin-plan-markers-layer'),

      // Перекрестие
      crosshair: document.getElementById('crosshair-overlay'),
      chLineH: document.getElementById('ch-line-h'),
      chLineV: document.getElementById('ch-line-v'),
      snapGuideH: document.getElementById('snap-guide-h'),
      snapGuideV: document.getElementById('snap-guide-v'),
      chReadout: document.getElementById('ch-readout'),

      // Правая панель формы
      chipsBox: document.getElementById('vitrines-chips'),
      editorHeading: document.getElementById('editor-heading'),
      btnNewVitrine: document.getElementById('btn-new-vitrine'),
      form: document.getElementById('vitrine-form'),
      formId: document.getElementById('form-vitrine-id'),
      formX: document.getElementById('form-x'),
      formY: document.getElementById('form-y'),
      formMapX: document.getElementById('form-map-x'),
      formMapY: document.getElementById('form-map-y'),
      formTitle: document.getElementById('form-title'),
      formEpoch: document.getElementById('form-epoch'),
      formDesc: document.getElementById('form-desc'),
      formAudio: document.getElementById('form-audio'),

      // Характеристики / Метки витрины (extraInfo)
      extraInfoContainer: document.getElementById('extra-info-container'),
      btnAddExtraInfo: document.getElementById('btn-add-extra-info'),

      // 3D Модель с мини-превью и удалением крестиком
      formModel3d: document.getElementById('form-model3d'),
      glbFilePicker: document.getElementById('glb-file-picker'),
      btnValidateGlb: document.getElementById('btn-validate-glb'),
      btnClearGlb: document.getElementById('btn-clear-glb'),
      glbMiniPreview: document.getElementById('admin-glb-mini-preview'),
      glbEmptyPlaceholder: document.getElementById('glb-empty-placeholder'),
      glbBadge: document.getElementById('glb-validation-badge'),
      glbStatusText: document.getElementById('glb-status-text'),

      // Галерея фотографий
      imagesContainer: document.getElementById('images-container'),
      btnAddImage: document.getElementById('btn-add-image'),
      btnDeleteVitrine: document.getElementById('btn-delete-vitrine'),

      // Модальное окно подтверждения удаления
      confirmBackdrop: document.getElementById('confirm-modal-backdrop'),
      confirmTitle: document.getElementById('confirm-modal-title'),
      confirmDesc: document.getElementById('confirm-modal-desc'),
      btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
      btnConfirmAccept: document.getElementById('btn-confirm-accept'),

      // Предпросмотр витрины
      lpBackdrop: document.getElementById('live-preview-backdrop'),
      lpCloseBtn: document.getElementById('lp-close-btn'),
      lpBtnGallery: document.getElementById('lp-btn-gallery'),
      lpBtn3d: document.getElementById('lp-btn-3d'),
      lpImg: document.getElementById('lp-img'),
      lpModel: document.getElementById('lp-model'),
      lpEpoch: document.getElementById('lp-epoch-badge'),
      lpHeading: document.getElementById('lp-spot-heading'),
      lpDesc: document.getElementById('lp-spot-desc'),
      lpAudio: document.getElementById('lp-spot-audio'),

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
      } catch (e) {}
    }
    await this.fetchDefaultData();
  }

  bindEvents() {
    this.dom.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    this.dom.btnFetch.addEventListener('click', () => {
      this.openConfirmDialog(
        'Вернуть исходную базу музея?',
        'Все несохранённые в файл изменения будут сброшены к начальному состоянию exhibits.json.',
        async () => {
          localStorage.removeItem('museum_exhibits_data');
          await this.fetchDefaultData();
          this.showToast('Восстановлена исходная база музея (exhibits.json)');
        }
      );
    });

    this.dom.btnExport.addEventListener('click', () => this.exportJsonFile());

    this.dom.hallSelect.addEventListener('change', () => {
      this.currentHallId = this.dom.hallSelect.value;
      this.selectedVitrineId = null;
      this.renderHallCanvas();
    });

    this.dom.viewModeSelect.addEventListener('change', () => {
      this.adminViewMode = this.dom.viewModeSelect.value;
      const isPlan = this.adminViewMode === 'building-plan';

      this.dom.viewport.classList.toggle('mode-panorama', !isPlan);
      this.dom.viewport.classList.toggle('mode-blueprint', isPlan);

      this.dom.planWrapper.classList.toggle('hidden', !isPlan);
      this.dom.hallImg.classList.toggle('hidden', isPlan);
      this.dom.markersLayer.classList.toggle('hidden', isPlan);
      this.dom.hallSelectWrap.classList.toggle('hidden', isPlan);
      this.dom.hudModeName.textContent = isPlan ? 'Схема здания' : 'Фотография зала';

      if (isPlan) {
        this.renderAdminPlanMarkers();
      } else {
        this.renderHallCanvas();
      }
    });

    this.dom.viewport.addEventListener('pointermove', (e) => this.handleViewportPointerMove(e));
    this.dom.viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.canvas-marker') || e.target.closest('.canvas-plan-node')) return;
      this.applyCoordinateFromEvent(e);
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingMarker = false;
    });

    [this.dom.formX, this.dom.formY, this.dom.formMapX, this.dom.formMapY].forEach((inp) => {
      inp.addEventListener('input', () => this.syncInputsToSelectedVitrine());
    });

    // Добавление новой характеристики / метки (extraInfo)
    this.dom.btnAddExtraInfo?.addEventListener('click', () => {
      this.addExtraInfoRow('', '');
    });

    // Управление 3D-моделью (.glb)
    this.dom.btnValidateGlb.addEventListener('click', () => {
      this.validateGlbAsset(this.dom.formModel3d.value.trim());
    });

    this.dom.formModel3d.addEventListener('input', () => {
      this.updateGlbMiniPreview(this.dom.formModel3d.value.trim());
    });

    this.dom.glbFilePicker?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const suggestedPath = `assets/models/${file.name}`;
      this.dom.formModel3d.value = suggestedPath;
      this.validateGlbAsset(suggestedPath);
    });

    this.dom.btnClearGlb.addEventListener('click', () => {
      this.dom.formModel3d.value = '';
      this.validateGlbAsset('');
      this.showToast('3D-модель откреплена от витрины');
    });

    this.dom.btnNewVitrine.addEventListener('click', () => this.createNewVitrine());
    this.dom.form.addEventListener('submit', (e) => this.handleFormSubmit(e));

    this.dom.btnDeleteVitrine.addEventListener('click', () => {
      const hall = this.getCurrentHall();
      const vitrine = hall?.hotspots?.find((v) => v.id === this.selectedVitrineId);
      const title = vitrine?.title || 'этот экспонат';

      this.openConfirmDialog(
        'Вы уверены, что хотите удалить этот экспонат?',
        `Витрина «${title}» будет удалена из зала «${hall?.name || ''}».`,
        () => this.deleteCurrentVitrine()
      );
    });

    this.dom.btnAddImage.addEventListener('click', () => this.addImageRow('', ''));

    this.dom.btnConfirmCancel.addEventListener('click', () => this.closeConfirmDialog());
    this.dom.confirmBackdrop.addEventListener('click', (e) => {
      if (e.target === this.dom.confirmBackdrop) this.closeConfirmDialog();
    });
    this.dom.btnConfirmAccept.addEventListener('click', () => {
      const fn = this.pendingConfirmAction;
      this.closeConfirmDialog();
      if (typeof fn === 'function') fn();
    });

    this.dom.btnLivePreview.addEventListener('click', () => this.openLivePreview());
    this.dom.lpCloseBtn.addEventListener('click', () => this.closeLivePreview());
    this.dom.lpBackdrop.addEventListener('click', (e) => {
      if (e.target === this.dom.lpBackdrop) this.closeLivePreview();
    });

    this.dom.lpBtnGallery.addEventListener('click', () => {
      this.dom.lpBtnGallery.classList.add('active');
      this.dom.lpBtn3d.classList.remove('active');
      this.dom.lpImg.classList.remove('hidden');
      this.dom.lpModel.classList.add('hidden');
    });

    this.dom.lpBtn3d.addEventListener('click', () => {
      this.dom.lpBtn3d.classList.add('active');
      this.dom.lpBtnGallery.classList.remove('active');
      this.dom.lpModel.classList.remove('hidden');
      this.dom.lpImg.classList.add('hidden');
    });
  }

  openConfirmDialog(title, desc, onConfirm) {
    this.pendingConfirmAction = onConfirm;
    if (this.dom.confirmTitle) this.dom.confirmTitle.textContent = title;
    if (this.dom.confirmDesc) this.dom.confirmDesc.textContent = desc;
    this.dom.confirmBackdrop.classList.remove('hidden');
  }

  closeConfirmDialog() {
    this.pendingConfirmAction = null;
    this.dom.confirmBackdrop.classList.add('hidden');
  }

  /* ==========================================================================
     ДОБАВЛЕНИЕ И РЕДАКТИРОВАНИЕ МЕТОК (extraInfo)
     ========================================================================== */
  addExtraInfoRow(label = '', value = '') {
    if (!this.dom.extraInfoContainer) return;
    const row = document.createElement('div');
    row.className = 'extra-info-row';

    const labelInp = document.createElement('input');
    labelInp.type = 'text';
    labelInp.className = 'form-input extra-label-input';
    labelInp.placeholder = 'Метка (напр. Материалы)';
    labelInp.value = label;

    const valInp = document.createElement('input');
    valInp.type = 'text';
    valInp.className = 'form-input extra-value-input';
    valInp.placeholder = 'Значение (напр. Фарфор)';
    valInp.value = value;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-remove-cross btn-remove-extra';
    delBtn.title = 'Удалить эту метку';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => row.remove());

    row.appendChild(labelInp);
    row.appendChild(valInp);
    row.appendChild(delBtn);
    this.dom.extraInfoContainer.appendChild(row);
  }

  /* ==========================================================================
     ВЫРАВНИВАНИЕ И УСТАНОВКА КООРДИНАТ КЛИКОМ НА ХОЛСТЕ
     ========================================================================== */
  snapValue(val) {
    if (!this.dom.snapToggle.checked) return Number(val.toFixed(1));
    const guides = [25, 50, 75];
    for (const g of guides) {
      if (Math.abs(val - g) < 1.2) return g;
    }
    return Number((Math.round(val * 2) / 2).toFixed(1));
  }

  handleViewportPointerMove(e) {
    const rect = this.dom.viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const relX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const relY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const snappedX = this.snapValue(relX);
    const snappedY = this.snapValue(relY);

    this.dom.chLineH.style.top = `${snappedY}%`;
    this.dom.chLineV.style.left = `${snappedX}%`;
    this.dom.chReadout.style.left = `${Math.min(82, snappedX)}%`;
    this.dom.chReadout.style.top = `${Math.max(8, snappedY)}%`;
    this.dom.chReadout.textContent = `X: ${snappedX.toFixed(1)}% | Y: ${snappedY.toFixed(1)}%`;
    this.dom.hudCursorCoords.textContent = `X: ${snappedX.toFixed(1)}% | Y: ${snappedY.toFixed(1)}%`;

    const isSnapX = [25, 50, 75].includes(snappedX);
    const isSnapY = [25, 50, 75].includes(snappedY);
    this.dom.snapGuideV.classList.toggle('hidden', !isSnapX);
    this.dom.snapGuideH.classList.toggle('hidden', !isSnapY);
    if (isSnapX) this.dom.snapGuideV.style.left = `${snappedX}%`;
    if (isSnapY) this.dom.snapGuideH.style.top = `${snappedY}%`;

    if (this.isDraggingMarker) {
      this.applyCoordinateFromEvent(e);
    }
  }

  applyCoordinateFromEvent(e) {
    if (!this.selectedVitrineId) return;

    if (this.adminViewMode === 'hall') {
      const rect = this.dom.viewport.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;

      const xPercent = this.snapValue(Math.max(2, Math.min(98, rawX)));
      const yPercent = this.snapValue(Math.max(4, Math.min(96, rawY)));

      this.dom.formX.value = xPercent;
      this.dom.formY.value = yPercent;

      const hall = this.getCurrentHall();
      const vitrine = hall?.hotspots?.find((v) => v.id === this.selectedVitrineId);
      if (vitrine) {
        vitrine.x = xPercent;
        vitrine.y = yPercent;
        this.persistData();
        this.renderMarkersAndChips();
      }
    } else {
      this.handlePlanCanvasClick(e);
    }
  }

  /* ==========================================================================
     ДОБАВЛЕНИЕ ФОТОГРАФИЙ С МИНИ-ПРЕВЬЮ И УДАЛЕНИЕМ КРЕСТИКОМ
     ========================================================================== */
  addImageRow(url = '', caption = '') {
    const card = document.createElement('div');
    card.className = 'dnd-image-card';
    card.draggable = true;

    card.innerHTML = `
      <div class="drag-handle" title="Потяните, чтобы поменять порядок фото">⋮⋮</div>
      <div class="thumb-preview-box">
        <img src="${url || ''}" alt="Превью" class="thumb-preview-img">
        <span class="thumb-status-pill" title="Статус загрузки картинки"></span>
      </div>
      <div class="dnd-inputs-col">
        <div class="img-url-row">
          <input type="text" class="form-input img-url-input" placeholder="assets/images/... или ссылка" value="${url}">
          <label class="btn btn-xs btn-secondary" title="Выбрать картинку на компьютере">
            📁 Файл
            <input type="file" class="img-file-picker" accept="image/*" hidden>
          </label>
        </div>
        <input type="text" class="form-input img-caption-input" placeholder="Подпись под фотографией (необязательно)" value="${caption}">
      </div>
      <button type="button" class="btn btn-remove-cross btn-remove-img" title="Удалить эту фотографию">&times;</button>
    `;

    const urlInput = card.querySelector('.img-url-input');
    const filePicker = card.querySelector('.img-file-picker');
    const thumbImg = card.querySelector('.thumb-preview-img');
    const statusPill = card.querySelector('.thumb-status-pill');

    const updateThumbnail = (val) => {
      if (!val) {
        thumbImg.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="58" height="46"%3E%3Crect width="100%25" height="100%25" fill="%2314141a"/%3E%3Ctext x="50%25" y="52%25" fill="%23666" font-size="9" text-anchor="middle" dominant-baseline="middle"%3EНет фото%3C/text%3E%3C/svg%3E';
        statusPill.className = 'thumb-status-pill';
        return;
      }
      thumbImg.onload = () => { statusPill.className = 'thumb-status-pill ok'; };
      thumbImg.onerror = () => { statusPill.className = 'thumb-status-pill err'; };
      thumbImg.src = val;
    };

    updateThumbnail(url);
    urlInput.addEventListener('input', () => updateThumbnail(urlInput.value.trim()));

    filePicker.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const suggestedPath = `assets/images/${file.name}`;
      urlInput.value = suggestedPath;

      const reader = new FileReader();
      reader.onload = (ev) => {
        thumbImg.src = ev.target.result;
        statusPill.className = 'thumb-status-pill ok';
      };
      reader.readAsDataURL(file);
    });

    card.querySelector('.btn-remove-img').addEventListener('click', () => {
      card.remove();
    });

    card.addEventListener('dragstart', (e) => {
      this.dragSrcRow = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.dom.imagesContainer.querySelectorAll('.dnd-image-card').forEach((c) => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.dragSrcRow && this.dragSrcRow !== card) card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (this.dragSrcRow && this.dragSrcRow !== card) {
        const all = [...this.dom.imagesContainer.children];
        const srcIdx = all.indexOf(this.dragSrcRow);
        const targetIdx = all.indexOf(card);
        if (srcIdx < targetIdx) card.after(this.dragSrcRow);
        else card.before(this.dragSrcRow);
      }
    });

    this.dom.imagesContainer.appendChild(card);
  }

  /* ==========================================================================
     МИНИ-ПРЕВЬЮ И ПРОВЕРКА 3D МОДЕЛИ (.GLB)
     ========================================================================== */
  updateGlbMiniPreview(url) {
    if (!this.dom.glbMiniPreview || !this.dom.glbEmptyPlaceholder) return;
    if (!url) {
      this.dom.glbMiniPreview.classList.add('hidden');
      this.dom.glbMiniPreview.removeAttribute('src');
      this.dom.glbEmptyPlaceholder.classList.remove('hidden');
      return;
    }
    this.dom.glbEmptyPlaceholder.classList.add('hidden');
    this.dom.glbMiniPreview.classList.remove('hidden');
    this.dom.glbMiniPreview.src = url;
  }

  async validateGlbAsset(url) {
    this.updateGlbMiniPreview(url);

    if (!url) {
      this.dom.glbBadge.className = 'asset-status-badge status-idle';
      this.dom.glbStatusText.textContent = '3D-модель не прикреплена (показываются только фото)';
      return;
    }

    this.dom.glbBadge.className = 'asset-status-badge status-idle';
    this.dom.glbStatusText.textContent = 'Проверка файла 3D-модели...';

    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        this.dom.glbBadge.className = 'asset-status-badge status-ok';
        this.dom.glbStatusText.textContent = '✓ 3D-модель успешно загружена и готова к показу';
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      this.dom.glbBadge.className = 'asset-status-badge status-error';
      this.dom.glbStatusText.textContent = '✕ Файл 3D-модели не найден по указанному адресу';
    }
  }

  /* ==========================================================================
     ЖИВОЙ ПРЕДПРОСМОТР ВИТРИНЫ ГЛАЗАМИ ПОСЕТИТЕЛЯ
     ========================================================================== */
  openLivePreview() {
    const title = this.dom.formTitle.value.trim() || 'Без названия';
    const epoch = this.dom.formEpoch.value.trim() || 'Архивный фонд ЛДПК';
    const desc = this.dom.formDesc.value.trim() || 'Описание пока не заполнено.';
    const audio = this.dom.formAudio.value.trim() || desc;
    const modelUrl = this.dom.formModel3d.value.trim();

    const firstImgInput = this.dom.imagesContainer.querySelector('.img-url-input');
    const imgUrl = firstImgInput?.value.trim() || this.getCurrentHall()?.bgImage || '';

    this.dom.lpHeading.textContent = title;
    this.dom.lpEpoch.textContent = epoch;
    this.dom.lpDesc.textContent = desc;
    this.dom.lpAudio.textContent = audio;
    this.dom.lpImg.src = imgUrl;

    if (modelUrl) {
      this.dom.lpModel.src = modelUrl;
      this.dom.lpBtn3d.disabled = false;
      this.dom.lpBtn3d.click();
    } else {
      this.dom.lpBtn3d.disabled = true;
      this.dom.lpBtnGallery.click();
    }

    this.dom.lpBackdrop.classList.remove('hidden');
  }

  closeLivePreview() {
    this.dom.lpBackdrop.classList.add('hidden');
  }

  /* ==========================================================================
     РАБОТА С БАЗОЙ EXHIBITS.JSON И LOCALSTORAGE
     ========================================================================== */
  async fetchDefaultData() {
    try {
      const response = await fetch('exhibits.json');
      if (!response.ok) throw new Error();
      this.data = await response.json();
      this.populateHallSelect();
    } catch (err) {
      this.showToast('Нажмите «📂 Загрузить базу», чтобы открыть файл exhibits.json');
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
        this.showToast('База музея успешно загружена из файла!');
      } catch (err) {
        this.showToast('Ошибка: выбранный файл повреждён или не является JSON');
      }
    };
    reader.readAsText(file);
  }

  persistData() {
    localStorage.setItem('museum_exhibits_data', JSON.stringify(this.data));
  }

  populateHallSelect() {
    if (!this.data.halls?.length) return;
    this.dom.hallSelect.innerHTML = '';
    this.data.halls.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name;
      this.dom.hallSelect.appendChild(opt);
    });
    this.currentHallId = this.data.halls[0].id;
    this.renderHallCanvas();
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
      marker.title = `${v.title} (X: ${v.x}%, Y: ${v.y}%)`;

      marker.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.selectVitrine(v.id);
        this.isDraggingMarker = true;
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

    (this.data.halls || []).forEach((h) => {
      const found = h.hotspots?.find((v) => v.id === vitrineId);
      if (found) {
        vitrine = found;
        if (this.currentHallId !== h.id) {
          this.currentHallId = h.id;
          this.dom.hallSelect.value = h.id;
          this.dom.hallImg.src = h.bgImage || '';
        }
      }
    });

    if (!vitrine) return;

    this.dom.hudSelectedId.textContent = vitrine.title || vitrineId;
    this.dom.editorHeading.textContent = vitrine.title || 'Настройка витрины';
    this.dom.formId.value = vitrine.id;
    this.dom.formX.value = vitrine.x ?? 50.0;
    this.dom.formY.value = vitrine.y ?? 50.0;
    this.dom.formMapX.value = vitrine.mapX ?? vitrine.x ?? 50.0;
    this.dom.formMapY.value = vitrine.mapY ?? vitrine.y ?? 50.0;
    this.dom.formTitle.value = vitrine.title || '';
    this.dom.formEpoch.value = vitrine.epoch || '';
    this.dom.formModel3d.value = vitrine.model3d || '';
    this.dom.formDesc.value = vitrine.description || '';
    this.dom.formAudio.value = vitrine.audioText || '';

    this.validateGlbAsset(vitrine.model3d || '');

    // Отрисовка фотографий
    this.dom.imagesContainer.innerHTML = '';
    (vitrine.images || []).forEach((img) => this.addImageRow(img.url, img.caption));

    // Отрисовка меток (extraInfo)
    if (this.dom.extraInfoContainer) {
      this.dom.extraInfoContainer.innerHTML = '';
      (vitrine.extraInfo || []).forEach((item) => this.addExtraInfoRow(item.label, item.value));
    }

    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
  }

  syncInputsToSelectedVitrine() {
    if (!this.selectedVitrineId) return;
    const hall = this.getCurrentHall();
    const vitrine = hall?.hotspots?.find((v) => v.id === this.selectedVitrineId);
    if (!vitrine) return;

    vitrine.x = parseFloat(this.dom.formX.value) || 50;
    vitrine.y = parseFloat(this.dom.formY.value) || 50;
    vitrine.mapX = parseFloat(this.dom.formMapX.value) || vitrine.x;
    vitrine.mapY = parseFloat(this.dom.formMapY.value) || vitrine.y;

    this.persistData();
    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') {
      this.renderAdminPlanMarkers();
    }
  }

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
    this.dom.planMarkersLayer.innerHTML = '';

    (this.data.halls || []).forEach((hall) => {
      const b = this.getHallRoomBounds(hall.id);
      (hall.hotspots || []).forEach((spot, idx) => {
        const mx = spot.mapX !== undefined ? spot.mapX : spot.x;
        const my = spot.mapY !== undefined ? spot.mapY : spot.y;
        const nodeX = Math.max(b.x + 14, Math.min(b.x + b.w - 14, b.x + (mx * b.w) / 100));
        const nodeY = Math.max(b.y + 20, Math.min(b.y + b.h - 14, b.y + (my * b.h) / 100));

        const isSelected = spot.id === this.selectedVitrineId;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'canvas-plan-node');
        g.setAttribute('transform', `translate(${nodeX.toFixed(1)}, ${nodeY.toFixed(1)})`);
        g.style.cursor = 'pointer';

        g.innerHTML = `
          <circle r="11" fill="${isSelected ? '#e5c158' : '#2a2723'}" stroke="#f5f2eb" stroke-width="2"></circle>
          <text y="3.5" fill="${isSelected ? '#121216' : '#f5f2eb'}" font-size="9.5" font-weight="800" text-anchor="middle">${idx + 1}</text>
        `;

        g.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.selectVitrine(spot.id);
          this.isDraggingMarker = true;
        });

        this.dom.planMarkersLayer.appendChild(g);
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

    let clickedHallId = null;
    for (const hid of ['college-history', 'achievements', 'region-history', 'military-glory']) {
      const b = this.getHallRoomBounds(hid);
      if (svgP.x >= b.x && svgP.x <= b.x + b.w && svgP.y >= b.y && svgP.y <= b.y + b.h) {
        clickedHallId = hid;
        break;
      }
    }
    if (!clickedHallId) return;

    const b = this.getHallRoomBounds(clickedHallId);
    const relX = this.snapValue(((svgP.x - b.x) / b.w) * 100);
    const relY = this.snapValue(((svgP.y - b.y) / b.h) * 100);

    let vitrine = null;
    let oldHall = null;
    (this.data.halls || []).forEach((h) => {
      const found = h.hotspots?.find((v) => v.id === this.selectedVitrineId);
      if (found) { vitrine = found; oldHall = h; }
    });
    if (!vitrine) return;

    vitrine.mapX = Math.max(4, Math.min(96, relX));
    vitrine.mapY = Math.max(6, Math.min(94, relY));
    this.dom.formMapX.value = vitrine.mapX;
    this.dom.formMapY.value = vitrine.mapY;

    if (oldHall && oldHall.id !== clickedHallId) {
      oldHall.hotspots = oldHall.hotspots.filter((v) => v.id !== vitrine.id);
      const targetHall = this.data.halls.find((h) => h.id === clickedHallId);
      targetHall?.hotspots.push(vitrine);
      this.currentHallId = clickedHallId;
      this.dom.hallSelect.value = clickedHallId;
    }

    this.persistData();
    this.renderAdminPlanMarkers();
  }

  createNewVitrine() {
    const hall = this.getCurrentHall();
    if (!hall) return;
    const newId = `vitrine-${Date.now().toString().slice(-4)}`;
    if (!hall.hotspots) hall.hotspots = [];

    hall.hotspots.push({
      id: newId,
      x: 50.0,
      y: 50.0,
      mapX: 50.0,
      mapY: 50.0,
      title: 'Новая витрина музея',
      epoch: '2026 г.',
      model3d: '',
      description: '',
      audioText: '',
      images: [],
      extraInfo: []
    });

    this.persistData();
    this.selectVitrine(newId);
    this.showToast('Создана новая витрина — кликните по фото зала, чтобы указать её место!');
  }

  handleFormSubmit(e) {
    e.preventDefault();
    const hall = this.getCurrentHall();
    if (!hall) return;

    const id = this.dom.formId.value;
    const existing = hall.hotspots?.find((v) => v.id === id);
    if (!existing) return;

    existing.x = parseFloat(this.dom.formX.value);
    existing.y = parseFloat(this.dom.formY.value);
    existing.mapX = parseFloat(this.dom.formMapX.value) || existing.x;
    existing.mapY = parseFloat(this.dom.formMapY.value) || existing.y;
    existing.title = this.dom.formTitle.value.trim();
    existing.epoch = this.dom.formEpoch.value.trim();
    existing.model3d = this.dom.formModel3d.value.trim();
    existing.description = this.dom.formDesc.value.trim();
    existing.audioText = this.dom.formAudio.value.trim();

    // Сохранение фотографий
    const images = [];
    this.dom.imagesContainer.querySelectorAll('.dnd-image-card').forEach((card) => {
      const url = card.querySelector('.img-url-input').value.trim();
      const caption = card.querySelector('.img-caption-input').value.trim();
      if (url) images.push({ url, caption });
    });
    existing.images = images;

    // Сохранение меток / характеристик (extraInfo)
    if (this.dom.extraInfoContainer) {
      const extraInfo = [];
      this.dom.extraInfoContainer.querySelectorAll('.extra-info-row').forEach((row) => {
        const l = row.querySelector('.extra-label-input').value.trim();
        const v = row.querySelector('.extra-value-input').value.trim();
        if (l && v) extraInfo.push({ label: l, value: v });
      });
      existing.extraInfo = extraInfo;
    }

    this.persistData();
    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') this.renderAdminPlanMarkers();
    this.showToast('Изменения успешно сохранены! Витрина уже обновлена в музее.');
  }

  deleteCurrentVitrine() {
    const hall = this.getCurrentHall();
    if (!hall || !this.selectedVitrineId) return;
    hall.hotspots = (hall.hotspots || []).filter((v) => v.id !== this.selectedVitrineId);
    this.selectedVitrineId = hall.hotspots[0]?.id || null;
    this.persistData();
    this.renderMarkersAndChips();
    if (this.adminViewMode === 'building-plan') this.renderAdminPlanMarkers();
    this.showToast('Витрина удалена из зала');
  }

  exportJsonFile() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exhibits.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Готовая база exhibits.json скачана на ваш компьютер!');
  }

  showToast(message) {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.dom.toast.classList.add('active');
    this.dom.toastMessage.textContent = message;
    this.toastTimeout = setTimeout(() => this.dom.toast.classList.remove('active'), 3400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MuseumStudioPro();
});