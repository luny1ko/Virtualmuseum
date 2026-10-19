// museum-3d-map.js
/**
 * Глобальное обновление «Виртуального музея ЛДПК»:
 * 1. Museum3DMap (Digital Twin) — 3D-маяк «ВЫ ЗДЕСЬ» (GPS-Beacon) + точный Raycasting витрин с хитбоксами и телепортацией.
 * 2. ChronoArchiveHub — Интерактивный Хроно-Архив 2.0 (Поиск, 3D-Tilt сетка + Timeline 1941–2026, смарт-теги).
 * 3. QuizBattleHUD — Геймифицированный «Экзамен на Хранителя Музея» (Таймер, XP, Streak x2/x3, Web Audio SFX, Конфетти, Сертификат).
 * 4. HologramXRayInspector — Голографический рентген-сканер витрины.
 */

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/* ==========================================================================
   1. ЧЕСТНЫЙ 3D-ПЛАН ЗДАНИЯ НА THREE.JS + GPS-МАЯК «ВЫ ЗДЕСЬ» + RAYCASTING
   ========================================================================== */
export class Museum3DMap {
  constructor(appInstance) {
    this.app = appInstance;
    this.wrapper = document.querySelector('.map-canvas-wrapper');
    this.svgFallback = document.getElementById('museum-svg-map');

    this.isReady = false;
    this.isRendering = false;
    this.force2D = false;
    this.rafId = null;
    this.clock = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.pointer = { x: -999, y: -999 };

    this.roomMeshes = new Map();
    this.obeliskItems = [];
    this.hitboxMeshes = [];
    this.hoveredItem = null;
    this.cameraTween = null;

    // 3D-маяк «ВЫ ЗДЕСЬ» (GPS-Beacon)
    this.userBeacon = {
      group: null,
      wave1: null,
      wave2: null,
      beam: null,
      badge: null,
      core: null,
      targetPos: null
    };

    // Архитектурные габариты залов из схемы здания (420x800, центр в 210, 400)
    this.hallSpecs = {
      'college-history': {
        x: 20, y: 20, w: 380, h: 230, wallH: 48,
        color: 0xfbbf24, emissive: 0xd97706, title: '01. ИСТОРИЯ ЛДПК'
      },
      'achievements': {
        x: 20, y: 260, w: 155, h: 520, wallH: 48,
        color: 0xc084fc, emissive: 0x7c3aed, title: '04. ДОСТИЖЕНИЯ'
      },
      'region-history': {
        x: 185, y: 260, w: 215, h: 280, wallH: 48,
        color: 0x38bdf8, emissive: 0x0284c7, title: '02. БЫТ И КУЛЬТУРА'
      },
      'military-glory': {
        x: 185, y: 550, w: 215, h: 230, wallH: 48,
        color: 0xf87171, emissive: 0xdc2626, title: '03. ВОЕННАЯ ПАМЯТЬ'
      }
    };

    this.init();
  }

  async init() {
    if (!this.wrapper) return;
    this.mountDOMOverlays();

    try {
      await loadExternalScript(THREE_CDN);
      await loadExternalScript(ORBIT_CDN);
      this.setupThreeScene();
      this.buildArchitectureGeometry();
      this.buildUserGpsBeacon();
      this.rebuildVitrineObelisks();
      this.bindInteractionEvents();
      this.isReady = true;
      this.syncRenderMode();
    } catch (err) {
      console.warn('[Museum3DMap]: Ошибка инициализации Three.js, активен 2D режим.', err);
      this.force2D = true;
      this.syncRenderMode();
    }
  }

  mountDOMOverlays() {
    this.wrapper.classList.add('digital-twin-stage');

    this.canvasHost = document.createElement('div');
    this.canvasHost.id = 'three-map-host';
    this.canvasHost.className = 'three-map-host';
    this.wrapper.appendChild(this.canvasHost);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'three-vitrine-tooltip hidden';
    this.wrapper.appendChild(this.tooltipEl);

    const headerTools = document.querySelector('.map-header-tools');
    if (headerTools && !document.getElementById('btn-toggle-webgl-map')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'btn-toggle-webgl-map';
      toggleBtn.className = 'btn-map-tool active';
      toggleBtn.innerHTML = '🧊 3D Twin (WebGL)';
      toggleBtn.addEventListener('click', () => {
        this.force2D = !this.force2D;
        toggleBtn.classList.toggle('active', !this.force2D);
        toggleBtn.innerHTML = this.force2D ? '📐 2D Чертеж' : '🧊 3D Twin (WebGL)';
        this.syncRenderMode();
      });
      headerTools.insertBefore(toggleBtn, headerTools.firstChild);
    }

    const resetCamBtn = document.createElement('button');
    resetCamBtn.type = 'button';
    resetCamBtn.className = 'three-reset-cam-btn';
    resetCamBtn.textContent = '⟲ Сбросить ракурс';
    resetCamBtn.addEventListener('click', () => this.animateCameraToDefault());
    this.canvasHost.appendChild(resetCamBtn);
  }

  setupThreeScene() {
    const THREE = window.THREE;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07070c, 0.0007);

    const width = this.wrapper.clientWidth || 880;
    const height = this.wrapper.clientHeight || 520;

    this.camera = new THREE.PerspectiveCamera(38, width / height, 10, 3500);
    this.camera.position.set(-420, 620, 580);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.canvasHost.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minPolarAngle = 0.22;
    this.controls.minDistance = 200;
    this.controls.maxDistance = 1250;
    this.controls.target.set(0, 10, 0);

    this.raycaster = new THREE.Raycaster();

    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(250, 600, 300);
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(1100, 44, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = -1;
    gridHelper.material.opacity = 0.22;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  planToWorld(planX, planY) {
    return { wx: planX - 210, wz: planY - 400 };
  }

  buildArchitectureGeometry() {
    const THREE = window.THREE;

    Object.entries(this.hallSpecs).forEach(([hallId, spec]) => {
      const group = new THREE.Group();
      const centerPlanX = spec.x + spec.w / 2;
      const centerPlanY = spec.y + spec.h / 2;
      const { wx, wz } = this.planToWorld(centerPlanX, centerPlanY);

      group.position.set(wx, 0, wz);
      group.userData = { hallId, spec };

      const boxGeo = new THREE.BoxGeometry(spec.w, spec.wallH, spec.h);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: spec.color,
        emissive: spec.emissive,
        emissiveIntensity: 0.08,
        roughness: 0.2,
        metalness: 0.1,
        transmission: 0.6,
        transparent: true,
        opacity: 0.34,
        depthWrite: false
      });

      const roomMesh = new THREE.Mesh(boxGeo, glassMat);
      roomMesh.position.y = spec.wallH / 2;
      roomMesh.userData = { type: 'hall', hallId };
      group.add(roomMesh);

      const edgesGeo = new THREE.EdgesGeometry(boxGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.65
      });
      const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
      wireframe.position.y = spec.wallH / 2;
      group.add(wireframe);

      const floorGeo = new THREE.PlaneGeometry(spec.w - 4, spec.h - 4);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x0b0b12,
        roughness: 0.35,
        metalness: 0.6,
        emissive: spec.emissive,
        emissiveIntensity: 0.12
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0.5;
      floorMesh.userData = { type: 'hall', hallId };
      group.add(floorMesh);

      const pointLight = new THREE.PointLight(spec.color, 1.35, 340, 1.8);
      pointLight.position.set(0, spec.wallH * 0.75, 0);
      group.add(pointLight);

      const labelSprite = this.createRoomLabelSprite(spec.title, spec.color);
      labelSprite.position.set(0, spec.wallH + 22, 0);
      group.add(labelSprite);

      this.scene.add(group);
      this.roomMeshes.set(hallId, { group, roomMesh, floorMesh, glassMat, edgesMat, pointLight, spec });
    });
  }

  createRoomLabelSprite(text, hexColor) {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(10, 10, 16, 0.82)';
    ctx.strokeStyle = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 80, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(130, 24, 1);
    return sprite;
  }

  /* ==========================================================================
     ЗАДАЧА 1: 3D-МАЯК «ВЫ ЗДЕСЬ» (GPS-BEACON С ВОЛНАМИ, ЛУЧОМ И BILLBOARD-БЕЙДЖЕМ)
     ========================================================================== */
  buildUserGpsBeacon() {
    const THREE = window.THREE;
    const beaconGroup = new THREE.Group();

    // 1. Центральный изумрудный диск на полу
    const coreGeo = new THREE.CircleGeometry(9, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.rotation.x = -Math.PI / 2;
    coreMesh.position.y = 1.8;
    beaconGroup.add(coreMesh);

    // 2. Две концентрические расходящиеся волны (Sonar Waves)
    const createWaveRing = () => {
      const geo = new THREE.RingGeometry(9, 13, 36);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 1.6;
      beaconGroup.add(mesh);
      return { mesh, mat };
    };

    const wave1 = createWaveRing();
    const wave2 = createWaveRing();

    // 3. Вертикальный неоновый луч света, уходящий вверх
    const beamGeo = new THREE.CylinderGeometry(1.2, 6.5, 92, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = 47;
    beaconGroup.add(beamMesh);

    // 4. Парящий 3D-бейдж «ВЫ ЗДЕСЬ» с автоматическим billboarding к камере
    const badgeSprite = this.createHereBadgeSprite();
    badgeSprite.position.set(0, 98, 0);
    beaconGroup.add(badgeSprite);

    // Точечный изумрудный свет маяка
    const beaconLight = new THREE.PointLight(0x10b981, 1.8, 180);
    beaconLight.position.set(0, 22, 0);
    beaconGroup.add(beaconLight);

    this.scene.add(beaconGroup);

    this.userBeacon = {
      group: beaconGroup,
      wave1,
      wave2,
      beam: beamMesh,
      badge: badgeSprite,
      core: coreMesh,
      targetPos: new THREE.Vector3(0, 0, 0)
    };

    this.updateUserBeaconPosition(this.app?.currentHall?.id || 'college-history', true);
  }

  createHereBadgeSprite() {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 110;
    const ctx = canvas.getContext('2d');

    // Изумрудная капсула с неоновым свечением
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(6, 28, 22, 0.94)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(14, 12, 332, 72, 36);
    ctx.fill();
    ctx.stroke();

    // Указательный треугольник вниз
    ctx.beginPath();
    ctx.moveTo(165, 84);
    ctx.lineTo(195, 84);
    ctx.lineTo(180, 104);
    ctx.closePath();
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // Пульсирующая точка-индикатор
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(56, 48, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#34d399';
    ctx.fill();

    ctx.font = '800 30px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ВЫ ЗДЕСЬ', 84, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(96, 30, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  /**
   * Плавное перемещение маяка «ВЫ ЗДЕСЬ» в свободный центр активного зала
   */
  updateUserBeaconPosition(hallId, instant = false) {
    if (!this.userBeacon.group || !window.THREE) return;
    const spec = this.hallSpecs[hallId] || this.hallSpecs['college-history'];

    // Размещаем маяк со смещением к входу комнаты, чтобы он не сливался с маркерами витрин
    const planX = spec.x + spec.w * 0.22;
    const planY = spec.y + spec.h * 0.28;
    const { wx, wz } = this.planToWorld(planX, planY);

    this.userBeacon.targetPos.set(wx, 0, wz);
    if (instant) {
      this.userBeacon.group.position.copy(this.userBeacon.targetPos);
    }
  }

  /* ==========================================================================
     ЗАДАЧА 2: ИНТЕРАКТИВНЫЕ 3D-МАРКЕРЫ ВИТРИН С УВЕЛИЧЕННЫМИ ХИТБОКСАМИ
     ========================================================================== */
  rebuildVitrineObelisks() {
    if (!this.scene || !window.THREE) return;
    const THREE = window.THREE;

    this.obeliskItems.forEach((item) => this.scene.remove(item.holder));
    this.obeliskItems = [];
    this.hitboxMeshes = [];

    const halls = this.app?.data?.halls || [];

    halls.forEach((hall) => {
      const spec = this.hallSpecs[hall.id];
      if (!spec) return;

      (hall.hotspots || []).forEach((spot, idx) => {
        const relX = spot.mapX !== undefined ? spot.mapX : spot.x;
        const relY = spot.mapY !== undefined ? spot.mapY : spot.y;

        const planX = spec.x + (relX / 100) * spec.w;
        const planY = spec.y + (relY / 100) * spec.h;
        const { wx, wz } = this.planToWorld(planX, planY);

        const holder = new THREE.Group();
        holder.position.set(wx, 0, wz);

        const payload = {
          type: 'vitrine',
          hallId: hall.id,
          hallName: hall.name,
          spot,
          index: idx + 1,
          baseColor: spec.color
        };

        // 1. Световой конус в пол
        const coneGeo = new THREE.ConeGeometry(11, 28, 20, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const lightCone = new THREE.Mesh(coneGeo, coneMat);
        lightCone.position.y = 14;
        holder.add(lightCone);

        // 2. Кольцо на полу
        const ringGeo = new THREE.RingGeometry(7, 11.5, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: spec.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
          depthWrite: false
        });
        const floorRing = new THREE.Mesh(ringGeo, ringMat);
        floorRing.rotation.x = -Math.PI / 2;
        floorRing.position.y = 1.4;
        holder.add(floorRing);

        // 3. Вращающийся 3D-обелиск (OctahedronGeometry)
        const octaGeo = new THREE.OctahedronGeometry(10, 0);
        const octaMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: spec.color,
          emissiveIntensity: 0.85,
          roughness: 0.15,
          metalness: 0.8
        });
        const obelisk = new THREE.Mesh(octaGeo, octaMat);
        obelisk.position.y = 28;
        obelisk.userData = payload;
        holder.add(obelisk);

        // 4. Невидимая сфера-хитбокс увеличенного радиуса (гарантирует 100% точность клика мышью и тачем)
        const hitGeo = new THREE.SphereGeometry(24, 12, 12);
        const hitMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.y = 26;
        hitbox.userData = { ...payload, itemRef: null };
        holder.add(hitbox);

        // 5. Мини-бейдж с номером витрины над кристаллом
        const numSprite = this.createVitrineNumSprite(idx + 1, spec.color);
        numSprite.position.set(0, 44, 0);
        holder.add(numSprite);

        const itemObj = {
          holder,
          obelisk,
          hitbox,
          octaMat,
          coneMat,
          floorRing,
          numSprite,
          payload,
          phase: idx * 0.85
        };
        hitbox.userData.itemRef = itemObj;
        obelisk.userData.itemRef = itemObj;

        this.scene.add(holder);
        this.obeliskItems.push(itemObj);
        this.hitboxMeshes.push(hitbox, obelisk);
      });
    });
  }

  createVitrineNumSprite(num, hexColor) {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(12, 12, 20, 0.92)';
    ctx.strokeStyle = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 26px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 32, 33);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16, 16, 1);
    return sprite;
  }

  highlightActiveHall(activeHallId) {
    this.roomMeshes.forEach((data, hallId) => {
      const isCurrent = hallId === activeHallId;
      data.glassMat.opacity = isCurrent ? 0.52 : 0.25;
      data.glassMat.emissiveIntensity = isCurrent ? 0.28 : 0.06;
      data.edgesMat.opacity = isCurrent ? 1.0 : 0.42;
      data.pointLight.intensity = isCurrent ? 2.2 : 0.85;
    });
    this.updateUserBeaconPosition(activeHallId, false);
  }

  bindInteractionEvents() {
    const domElem = this.renderer.domElement;

    const updatePointerFromEvent = (e) => {
      const rect = domElem.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return { localX: e.clientX - rect.left, localY: e.clientY - rect.top };
    };

    domElem.addEventListener('pointermove', (e) => {
      const { localX, localY } = updatePointerFromEvent(e);
      this.performRaycast(localX, localY);
    });

    let downPos = { x: 0, y: 0, time: 0 };
    domElem.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY, time: performance.now() };
      updatePointerFromEvent(e);
    });

    domElem.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      const elapsed = performance.now() - downPos.time;
      // Допускаем небольшое смещение руки при клике (до 12px)
      if (dist > 12 || elapsed > 600) return;
      updatePointerFromEvent(e);
      this.handleSceneClick();
    });

    window.addEventListener('resize', () => this.handleResize());

    const liteObserver = new MutationObserver(() => this.syncRenderMode());
    liteObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  performRaycast(localX, localY) {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(this.hitboxMeshes, true);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const itemRef = hitObj.userData?.itemRef;
      if (itemRef) {
        this.hoveredItem = itemRef;
        this.renderer.domElement.style.cursor = 'pointer';

        const { spot, index, hallName } = itemRef.payload;
        this.tooltipEl.innerHTML = `
          <span class="tt-hall">${hallName} • ВИТРИНА №${index}</span>
          <strong class="tt-title">${spot.title}</strong>
          <span class="tt-epoch">${spot.epoch || 'Исторический фонд'} — Нажмите для телепортации</span>
        `;
        this.tooltipEl.style.left = `${localX}px`;
        this.tooltipEl.style.top = `${localY - 20}px`;
        this.tooltipEl.classList.remove('hidden');
        return;
      }
    }

    this.hoveredItem = null;
    this.renderer.domElement.style.cursor = 'grab';
    this.tooltipEl.classList.add('hidden');
  }

  handleSceneClick() {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 1. Приоритетная проверка клика по 3D-маркеру витрины (или наведенному маркеру)
    const vitrineHits = this.raycaster.intersectObjects(this.hitboxMeshes, true);
    const activeVitrineItem = vitrineHits[0]?.object?.userData?.itemRef || this.hoveredItem;

    if (activeVitrineItem) {
      const { hallId, spot } = activeVitrineItem.payload;
      const worldPos = new window.THREE.Vector3();
      activeVitrineItem.obelisk.getWorldPosition(worldPos);

      this.tooltipEl.classList.add('hidden');

      // Кинематографичный подлёт камеры к выбранному маркеру -> закрытие карты -> открытие витрины
      this.flyCameraToPoint(worldPos, async () => {
        await this.executeVitrineTeleport(hallId, spot);
      });
      return;
    }

    // 2. Если кликнули просто по полу/боксу комнаты — переходим в этот зал
    const roomTargets = [];
    this.roomMeshes.forEach((r) => {
      roomTargets.push(r.floorMesh, r.roomMesh);
    });
    const roomHits = this.raycaster.intersectObjects(roomTargets, false);

    if (roomHits.length > 0) {
      const { hallId } = roomHits[0].object.userData;
      const roomData = this.roomMeshes.get(hallId);
      if (roomData) {
        const centerWorld = roomData.group.position.clone();
        this.flyCameraToPoint(centerWorld, async () => {
          if (this.app) {
            this.app.closeMap();
            if (this.app.currentHall?.id !== hallId) {
              await this.app.switchHall(hallId);
            }
          }
        });
      }
    }
  }

  /**
   * Надежный телепорт к витрине: закрывает 3D-карту, переключает зал и гарантированно распахивает Drawer
   */
  async executeVitrineTeleport(hallId, spotObject) {
    if (!this.app || !spotObject) return;

    this.app.closeMap();
    this.stopLoop();

    // Если пользователь уже в нужном зале и не идет переход — сразу открываем шторку витрины
    if (this.app.currentHall?.id === hallId && !this.app.isTransitioning) {
      const targetSpot =
        this.app.currentHall.hotspots?.find((s) => s.id === spotObject.id) || spotObject;
      setTimeout(() => {
        this.app.openVitrineDrawer(targetSpot);
      }, 120);
      return;
    }

    // Иначе переключаем зал с передачей ID целевой витрины
    this.app.isTransitioning = false;
    await this.app.switchHall(hallId, spotObject.id);

    // Страховочная проверка: если видео-переход завершился, убеждаемся, что шторка открыта
    setTimeout(() => {
      if (this.app.dom?.drawer && !this.app.dom.drawer.classList.contains('active')) {
        const freshHall = this.app.data?.halls?.find((h) => h.id === hallId);
        const freshSpot = freshHall?.hotspots?.find((s) => s.id === spotObject.id) || spotObject;
        this.app.openVitrineDrawer(freshSpot);
      }
    }, 450);
  }

  flyCameraToPoint(targetVec, onComplete) {
    const startCam = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endTarget = new window.THREE.Vector3(targetVec.x, 22, targetVec.z);
    const endCam = new window.THREE.Vector3(targetVec.x - 105, 155, targetVec.z + 145);

    this.cameraTween = {
      startTime: performance.now(),
      duration: 580,
      startCam,
      endCam,
      startTarget,
      endTarget,
      onComplete
    };
  }

  animateCameraToDefault() {
    if (!window.THREE || !this.camera) return;
    this.cameraTween = {
      startTime: performance.now(),
      duration: 550,
      startCam: this.camera.position.clone(),
      endCam: new window.THREE.Vector3(-420, 620, 580),
      startTarget: this.controls.target.clone(),
      endTarget: new window.THREE.Vector3(0, 10, 0),
      onComplete: null
    };
  }

  handleResize() {
    if (!this.renderer || !this.camera || !this.wrapper) return;
    const width = this.wrapper.clientWidth || 880;
    const height = Math.max(440, this.wrapper.clientHeight || 520);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  syncRenderMode() {
    const isLite = document.body.classList.contains('lite-mode');
    const use2D = isLite || this.force2D || !this.isReady;

    if (this.svgFallback) {
      this.svgFallback.style.display = use2D ? 'block' : 'none';
    }
    if (this.canvasHost) {
      this.canvasHost.style.display = use2D ? 'none' : 'block';
    }

    if (!use2D && this.app?.isMapOpen) {
      this.handleResize();
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  startLoop() {
    if (this.isRendering) return;
    this.isRendering = true;
    this.renderLoop();
  }

  stopLoop() {
    this.isRendering = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderLoop() {
    if (!this.isRendering) return;
    const elapsed = this.clock ? this.clock.getElapsedTime() : performance.now() * 0.001;

    // 1. Анимация перелёта камеры
    if (this.cameraTween) {
      const now = performance.now();
      const progress = Math.min(1, (now - this.cameraTween.startTime) / this.cameraTween.duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(this.cameraTween.startCam, this.cameraTween.endCam, ease);
      this.controls.target.lerpVectors(this.cameraTween.startTarget, this.cameraTween.endTarget, ease);

      if (progress >= 1) {
        const cb = this.cameraTween.onComplete;
        this.cameraTween = null;
        if (typeof cb === 'function') cb();
      }
    }

    // 2. Анимация 3D-маяка «ВЫ ЗДЕСЬ» (концентрические волны + левитация бейджа)
    if (this.userBeacon.group) {
      this.userBeacon.group.position.lerp(this.userBeacon.targetPos, 0.08);

      const w1Phase = (elapsed * 0.85) % 1;
      const w2Phase = (elapsed * 0.85 + 0.5) % 1;

      this.userBeacon.wave1.mesh.scale.setScalar(1 + w1Phase * 3.4);
      this.userBeacon.wave1.mat.opacity = (1 - w1Phase) * 0.85;

      this.userBeacon.wave2.mesh.scale.setScalar(1 + w2Phase * 3.4);
      this.userBeacon.wave2.mat.opacity = (1 - w2Phase) * 0.85;

      this.userBeacon.badge.position.y = 96 + Math.sin(elapsed * 3.2) * 4;
    }

    // 3. Анимация маркеров витрин (Scale 1.35 + яркое свечение при наведении)
    this.obeliskItems.forEach((item) => {
      const isHovered = this.hoveredItem === item;
      item.obelisk.rotation.y = elapsed * (isHovered ? 3.4 : 1.2) + item.phase;
      item.obelisk.position.y = 28 + Math.sin(elapsed * 2.5 + item.phase) * 3.2;

      const targetScale = isHovered ? 1.38 : 1.0;
      item.obelisk.scale.lerp(new window.THREE.Vector3(targetScale, targetScale, targetScale), 0.16);
      item.octaMat.emissiveIntensity = isHovered ? 2.2 : 0.85;
      item.coneMat.opacity = isHovered ? 0.55 : 0.24;

      const ringPulse = 1 + Math.sin(elapsed * 3 + item.phase) * 0.18;
      item.floorRing.scale.set(ringPulse, ringPulse, 1);
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.rafId = requestAnimationFrame(() => this.renderLoop());
  }
}

/* ==========================================================================
   ЗАДАЧА 3: ИНТЕРАКТИВНЫЙ ХРОНО-АРХИВ 2.0 (ВСЕ ЭКСПОНАТЫ: 3D-TILT И TIMELINE)
   ========================================================================== */
export class ChronoArchiveHub {
  constructor(appInstance) {
    this.app = appInstance;
    this.viewMode = 'grid'; // 'grid' | 'timeline'
    this.searchQuery = '';
    this.smartTag = 'all'; // 'all' | '3d' | 'relics' | 'docs'
    this.sortOrder = 'asc'; // 'asc' (1941->2026) | 'desc' (2026->1941)

    this.hallColorMap = {
      'college-history': { color: '#fbbf24', bg: 'rgba(217, 119, 6, 0.18)', border: 'rgba(251, 191, 36, 0.45)' },
      'region-history':  { color: '#38bdf8', bg: 'rgba(2, 132, 199, 0.18)', border: 'rgba(56, 189, 248, 0.45)' },
      'military-glory':  { color: '#f87171', bg: 'rgba(220, 38, 38, 0.18)', border: 'rgba(248, 113, 113, 0.45)' },
      'achievements':    { color: '#c084fc', bg: 'rgba(124, 58, 237, 0.18)', border: 'rgba(192, 132, 252, 0.45)' }
    };

    this.init();
  }

  init() {
    this.injectArchiveToolbar();
    this.overrideCatalogRendering();
  }

  injectArchiveToolbar() {
    const sheetHeader = document.querySelector('#catalog-sheet .sheet-header');
    if (!sheetHeader || document.getElementById('chrono-archive-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'chrono-archive-toolbar';
    toolbar.className = 'chrono-archive-toolbar';

    toolbar.innerHTML = `
      <!-- Живой поиск по ключевым словам -->
      <div class="archive-search-box">
        <svg class="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="search" id="archive-live-search" class="archive-search-input"
               placeholder="Живой поиск (например: арифмометр, ЛиАЗ, фарфор, кубок, 1941)...">
        <span id="archive-found-counter" class="archive-found-badge">0</span>
      </div>

      <!-- Смарт-теги категорий -->
      <div class="archive-smart-tags" id="archive-smart-tags">
        <button type="button" class="smart-tag-btn active" data-tag="all">✨ Все фонды</button>
        <button type="button" class="smart-tag-btn" data-tag="3d">🧊 Только с 3D-моделями</button>
        <button type="button" class="smart-tag-btn" data-tag="relics">🏺 Исторические реликвии</button>
        <button type="button" class="smart-tag-btn" data-tag="docs">📜 Документы и летопись</button>
      </div>

      <!-- Переключатель вида: Карточки 3D-Tilt / Временная шкала (Timeline 1941-2026) -->
      <div class="archive-view-controls">
        <button type="button" id="archive-sort-btn" class="archive-sort-btn" title="Сортировка по хронологии">
          ⇅ 1941 → 2026
        </button>
        <div class="view-mode-segmented">
          <button type="button" class="view-seg-btn active" data-view="grid">🎴 Карточки 3D-Tilt</button>
          <button type="button" class="view-seg-btn" data-view="timeline">⏳ Шкала 1941–2026</button>
        </div>
      </div>
    `;

    sheetHeader.insertAdjacentElement('afterend', toolbar);

    // События живого поиска
    const searchInput = document.getElementById('archive-live-search');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.app.renderCatalogItems();
    });

    // События смарт-тегов
    document.getElementById('archive-smart-tags').addEventListener('click', (e) => {
      const btn = e.target.closest('.smart-tag-btn');
      if (!btn) return;
      document.querySelectorAll('.smart-tag-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      this.smartTag = btn.getAttribute('data-tag') || 'all';
      this.app.renderCatalogItems();
    });

    // Сортировка по годам
    const sortBtn = document.getElementById('archive-sort-btn');
    sortBtn.addEventListener('click', () => {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      sortBtn.textContent = this.sortOrder === 'asc' ? '⇅ 1941 → 2026' : '⇅ 2026 → 1941';
      this.app.renderCatalogItems();
    });

    // Переключение режима отображения
    toolbar.querySelectorAll('.view-seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.view-seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.getAttribute('data-view');
        this.app.renderCatalogItems();
      });
    });
  }

  /**
   * Извлекает стартовый год из строки эпохи (для точной сортировки на шкале 1941–2026)
   */
  parseYear(epochStr = '') {
    const match = epochStr.match(/(19\d{2}|20\d{2})/);
    if (match) return parseInt(match[1], 10);
    if (epochStr.includes('XIX')) return 1895;
    if (epochStr.toLowerCase().includes('современ')) return 2024;
    return 1975;
  }

  /**
   * Классифицирует экспонат для фильтр-тегов («Реликвии» vs «Документы»)
   */
  matchesSmartTag(spot) {
    if (this.smartTag === 'all') return true;
    const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');
    if (this.smartTag === '3d') return has3D;

    const text = `${spot.title} ${spot.description}`.toLowerCase();
    const isRelic = /(арифмометр|сервиз|фарфор|радиола|самовар|кубок|чашка|фотоаппарат|баян)/i.test(text) || has3D;
    const isDoc = /(книга памяти|становление|история в лицах|директор|проект|профессионалитет|студия|подвиг|письм)/i.test(text);

    if (this.smartTag === 'relics') return isRelic;
    if (this.smartTag === 'docs') return isDoc;
    return true;
  }

  overrideCatalogRendering() {
    if (!this.app) return;

    this.app.renderCatalogItems = () => {
      const container = this.app.dom.catalogGrid;
      if (!container) return;
      container.innerHTML = '';

      const allHalls = this.app.data?.halls || [];
      const collected = [];

      allHalls.forEach((hall) => {
        if (this.app.catalogFilter !== 'all' && this.app.catalogFilter !== hall.id) return;

        (hall.hotspots || []).forEach((spot) => {
          // 1. Проверка живого поиска
          if (this.searchQuery) {
            const extraText = (spot.extraInfo || []).map((i) => `${i.label} ${i.value}`).join(' ');
            const haystack = `${spot.title} ${spot.epoch} ${spot.description} ${hall.name} ${extraText}`.toLowerCase();
            if (!haystack.includes(this.searchQuery)) return;
          }
          // 2. Проверка смарт-тега
          if (!this.matchesSmartTag(spot)) return;

          collected.push({
            hall,
            spot,
            year: this.parseYear(spot.epoch)
          });
        });
      });

      // Сортировка по хронологии
      collected.sort((a, b) => (this.sortOrder === 'asc' ? a.year - b.year : b.year - a.year));

      // Обновляем счетчик найденных экспонатов
      const counterEl = document.getElementById('archive-found-counter');
      if (counterEl) counterEl.textContent = `${collected.length} шт.`;

      if (collected.length === 0) {
        container.className = 'catalog-empty-state';
        container.innerHTML = `
          <div class="empty-archive-box">
            <span class="empty-icon">🔍</span>
            <h3>В архивных фондах ничего не найдено</h3>
            <p>Попробуйте сбросить фильтр или изменить поисковый запрос.</p>
          </div>
        `;
        return;
      }

      if (this.viewMode === 'timeline') {
        this.renderTimelineMode(container, collected);
      } else {
        this.renderGridMode(container, collected);
      }
    };
  }

  renderGridMode(container, items) {
    container.className = 'catalog-grid chrono-grid-mode';

    items.forEach(({ hall, spot }, idx) => {
      const card = document.createElement('div');
      card.className = 'catalog-card holo-archive-card';
      card.style.animationDelay = `${idx * 0.055}s`;

      const palette = this.hallColorMap[hall.id] || this.hallColorMap['college-history'];
      card.style.setProperty('--card-hall-color', palette.color);
      card.style.setProperty('--card-hall-bg', palette.bg);
      card.style.setProperty('--card-hall-border', palette.border);

      const previewImg = (spot.images && spot.images.length > 0)
        ? spot.images[0].url
        : (hall.bgImage || 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80');

      const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');
      const extraTags = (spot.extraInfo || []).slice(0, 2).map((info) =>
        `<span class="card-meta-pill">${this.app.escapeHtml(info.label)}: <b>${this.app.escapeHtml(info.value)}</b></span>`
      ).join('');

      card.innerHTML = `
        <div class="card-media-box">
          <img src="${previewImg}" alt="${this.app.escapeHtml(spot.title)}" class="card-img"
               onerror="this.src='https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'">
          <span class="card-hall-badge" style="color:${palette.color}; border-color:${palette.border}; background:${palette.bg};">
            ${this.app.escapeHtml(hall.name)}
          </span>
          ${has3D ? '<span class="card-3d-badge">🧊 3D GLB</span>' : ''}
        </div>
        <div class="card-content">
          <div class="card-epoch-row">
            <span class="card-epoch">${this.app.escapeHtml(spot.epoch || 'Фонд ЛДПК')}</span>
          </div>
          <h3 class="card-title">${this.app.escapeHtml(spot.title)}</h3>
          <p class="card-desc">${this.app.escapeHtml(spot.description || '')}</p>
          ${extraTags ? `<div class="card-meta-pills">\${extraTags}</div>` : ''}
          <div class="card-action-btn">Открыть витрину в зале →</div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.app.closeCatalog();
        this.app.teleportToVitrine(hall.id, spot.id);
      });

      container.appendChild(card);
    });
  }

  renderTimelineMode(container, items) {
    container.className = 'chrono-timeline-wrapper';

    const axisLine = document.createElement('div');
    axisLine.className = 'chrono-timeline-axis';
    container.appendChild(axisLine);

    items.forEach(({ hall, spot, year }, idx) => {
      const node = document.createElement('div');
      node.className = `timeline-node ${idx % 2 === 0 ? 'left' : 'right'}`;
      node.style.animationDelay = `${idx * 0.065}s`;

      const palette = this.hallColorMap[hall.id] || this.hallColorMap['college-history'];
      const previewImg = (spot.images && spot.images.length > 0)
        ? spot.images[0].url
        : (hall.bgImage || 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80');
      const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');

      node.innerHTML = `
        <div class="timeline-year-marker" style="border-color:${palette.color}; color:${palette.color};">
          <span>${year < 1941 ? 'XIX в.' : year}</span>
        </div>
        <div class="timeline-card catalog-card" style="--card-hall-color:${palette.color};">
          <img src="${previewImg}" alt="${this.app.escapeHtml(spot.title)}" class="timeline-thumb"
               onerror="this.src='https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'">
          <div class="timeline-card-body">
            <div class="timeline-badges">
              <span class="tl-hall-tag" style="color:${palette.color}; border-color:${palette.border};">${this.app.escapeHtml(hall.name)}</span>
              <span class="tl-epoch-tag">${this.app.escapeHtml(spot.epoch)}</span>
              ${has3D ? '<span class="tl-3d-tag">🧊 3D</span>' : ''}
            </div>
            <h3 class="timeline-title">${this.app.escapeHtml(spot.title)}</h3>
            <p class="timeline-desc">${this.app.escapeHtml(spot.description)}</p>
            <span class="timeline-teleport-link">Перейти к стенду →</span>
          </div>
        </div>
      `;

      node.querySelector('.timeline-card').addEventListener('click', () => {
        this.app.closeCatalog();
        this.app.teleportToVitrine(hall.id, spot.id);
      });

      container.appendChild(node);
    });
  }
}

/* ==========================================================================
   ЗАДАЧА 4: ГЕЙМИФИКАЦИЯ «ЭКЗАМЕН НА ХРАНИТЕЛЯ МУЗЕЯ» (QUIZ BATTLE HUD)
   ========================================================================== */
export class QuizBattleHUD {
  constructor(appInstance) {
    this.app = appInstance;
    this.xp = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.timeLeft = 20;
    this.timerInterval = null;
    this.keeperName = localStorage.getItem('ldpk_keeper_name') || 'Илья Мазанов';
    this.audioCtx = null;

    this.init();
  }

  init() {
    if (!this.app) return;

    // Обновляем заголовок модального окна
    const titleEl = document.getElementById('quiz-modal-title');
    if (titleEl) titleEl.textContent = 'Испытание: Экзамен на Хранителя Музея';

    // Перехватываем открытие, закрытие и рендер шагов викторины
    const origOpenQuiz = this.app.openQuiz.bind(this.app);
    this.app.openQuiz = () => {
      this.xp = 0;
      this.streak = 0;
      this.maxStreak = 0;
      origOpenQuiz();
    };

    const origCloseQuiz = this.app.closeQuiz.bind(this.app);
    this.app.closeQuiz = () => {
      this.stopTimer();
      origCloseQuiz();
    };

    this.app.renderQuizStep = () => this.renderBattleStep();
  }

  startQuestionTimer(onTimeOut) {
    this.stopTimer();
    this.timeLeft = 20;
    const totalTime = 20;

    const ringEl = document.getElementById('battle-timer-circle');
    const textEl = document.getElementById('battle-timer-sec');
    const circumference = 2 * Math.PI * 22; // r = 22 -> ~138.2

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (textEl) textEl.textContent = `${this.timeLeft}с`;
      if (ringEl) {
        const offset = circumference - (this.timeLeft / totalTime) * circumference;
        ringEl.style.strokeDashoffset = offset.toFixed(1);
        if (this.timeLeft <= 5) {
          ringEl.style.stroke = '#ef4444';
          this.playTickSfx();
        }
      }

      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (typeof onTimeOut === 'function') onTimeOut();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  renderBattleStep() {
    this.stopTimer();
    const body = this.app.dom.quizBody;
    if (!body) return;

    const questions = this.app.quizQuestions;
    const total = questions.length;
    const idx = this.app.quizCurrentIndex;

    if (idx >= total) {
      this.renderCertificateScreen(body, total);
      return;
    }

    const currentQ = questions[idx];
    const progressPercent = (idx / total) * 100;

    body.innerHTML = `
      <!-- Верхний киберспортивный / музейный Battle HUD -->
      <div class="battle-hud-bar">
        <div class="hud-stat-pill xp-pill">
          <span class="stat-label">ОПЫТ ХРАНИТЕЛЯ</span>
          <strong class="stat-val" id="battle-xp-val">${this.xp} XP</strong>
        </div>

        <div class="hud-timer-widget" title="Время на ответ">
          <svg class="timer-ring-svg" width="54" height="54" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="22" stroke="rgba(255,255,255,0.1)" stroke-width="4" fill="none"/>
            <circle id="battle-timer-circle" cx="27" cy="27" r="22" stroke="#38bdf8" stroke-width="4" fill="none"
                    stroke-dasharray="138.2" stroke-dashoffset="0" stroke-linecap="round"/>
          </svg>
          <span id="battle-timer-sec" class="timer-sec-text">20с</span>
        </div>

        <div class="hud-stat-pill streak-pill ${this.streak >= 2 ? 'combo-hot' : ''}">
          <span class="stat-label">СЕРИЯ ОТВЕТОВ</span>
          <strong class="stat-val" id="battle-streak-val">
            ${this.streak >= 2 ? `🔥 COMBO x\${this.streak}` : `x\${Math.max(1, this.streak)}`}
          </strong>
        </div>
      </div>

      <div class="quiz-progress-bar-wrap">
        <div class="quiz-progress-fill" style="width: ${progressPercent}%;"></div>
      </div>

      <div class="quiz-question-number">АРХИВНЫЙ РУБЕЖ ${idx + 1} ИЗ ${total}</div>
      <h3 class="quiz-question-text">${this.app.escapeHtml(currentQ.question)}</h3>

      <div class="quiz-options-list">
        ${currentQ.options.map((opt, i) => `
          <button type="button" class="quiz-option-btn battle-opt-btn" data-opt-idx="\${i}">
            <span class="opt-key-index">0\${i + 1}</span>
            <span>\${this.app.escapeHtml(opt)}</span>
          </button>
        `).join('')}
      </div>

      <div id="quiz-feedback-box"></div>
      <button type="button" id="quiz-action-next" class="quiz-next-btn" style="display: none;">
        ${idx + 1 === total ? 'Завершить и получить сертификат →' : 'Следующий рубеж →'}
      </button>
    `;

    const optionButtons = body.querySelectorAll('.quiz-option-btn');
    const feedbackBox = body.querySelector('#quiz-feedback-box');
    const nextBtn = body.querySelector('#quiz-action-next');

    const finalizeAnswer = (selectedIdx) => {
      this.stopTimer();
      const isTimeout = selectedIdx === -1;
      const isCorrect = selectedIdx === currentQ.correct;

      optionButtons.forEach((b) => { b.disabled = true; });

      if (isCorrect) {
        optionButtons[selectedIdx].classList.add('correct');
        this.app.quizScore++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;

        // Начисление XP с учетом комбо-множителя и бонуса за скорость
        const speedBonus = Math.max(10, this.timeLeft * 5);
        const gainedXp = (150 + speedBonus) * this.streak;
        this.xp += gainedXp;

        this.playAnswerSfx(true);
        document.getElementById('battle-xp-val').textContent = `${this.xp} XP (+${gainedXp})`;
        document.getElementById('battle-streak-val').textContent = `🔥 COMBO x${this.streak}`;
      } else {
        if (!isTimeout && optionButtons[selectedIdx]) {
          optionButtons[selectedIdx].classList.add('wrong');
        }
        if (optionButtons[currentQ.correct]) {
          optionButtons[currentQ.correct].classList.add('correct');
        }
        this.streak = 0;
        this.playAnswerSfx(false);
        document.getElementById('battle-streak-val').textContent = 'СБРОС x1';
      }

      if (feedbackBox) {
        feedbackBox.innerHTML = `
          <div class="quiz-explanation-box">
            <strong>${isCorrect ? '✓ Доступ подтвержден!' : isTimeout ? '⏱ Время вышло!' : '✕ Архивная справка:'}</strong>
            ${this.app.escapeHtml(currentQ.explanation)}
          </div>
        `;
      }

      if (nextBtn) nextBtn.style.display = 'block';
    };

    optionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = parseInt(btn.getAttribute('data-opt-idx'), 10);
        finalizeAnswer(chosen);
      });
    });

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.app.quizCurrentIndex++;
        this.renderBattleStep();
      });
    }

    this.startQuestionTimer(() => finalizeAnswer(-1));
  }

  /**
   * Экран персонального сертификата «Знаток истории ЛДПК» + микро-конфетти на Canvas
   */
  renderCertificateScreen(body, total) {
    const score = this.app.quizScore;
    const ratio = score / total;

    let rankTitle = 'Кандидат-исследователь ЛДПК';
    let rankBadge = 'БРОНЗОВЫЙ ДОПУСК';
    if (ratio === 1) {
      rankTitle = 'Магистр-Хранитель Фондов ЛДПК';
      rankBadge = 'ЗОЛОТОЙ ОРДЕН ХРАНИТЕЛЯ';
    } else if (ratio >= 0.8) {
      rankTitle = 'Почётный краевед и знаток ЛДПК';
      rankBadge = 'СЕРЕБРЯНЫЙ ДОПУСК';
    }

    const certCode = `LDPK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    body.innerHTML = `
      <div class="cert-stage-wrapper">
        <canvas id="quiz-confetti-canvas" class="quiz-confetti-canvas"></canvas>

        <div class="keeper-certificate-card" id="keeper-certificate-card">
          <div class="cert-header-row">
            <span class="cert-seal-badge">${rankBadge}</span>
            <span class="cert-id-code">ID: ${certCode}</span>
          </div>

          <h3 class="cert-main-heading">СЕРТИФИКАТ ЗНАТОКА ИСТОРИИ ЛДПК</h3>
          <p class="cert-sub-caption">Ликино-Дулёвский политехнический колледж • Хроника 1941–2026</p>

          <div class="cert-owner-input-row">
            <label for="cert-keeper-input">Владелец сертификата:</label>
            <input type="text" id="cert-keeper-input" class="cert-name-input" value="${this.app.escapeHtml(this.keeperName)}" placeholder="Введите ваше имя">
          </div>

          <div class="cert-Assigned-rank">${rankTitle}</div>

          <div class="cert-metrics-grid">
            <div class="cert-metric">
              <span>ТОЧНОСТЬ</span>
              <strong>${score} / ${total} (${Math.round(ratio * 100)}%)</strong>
            </div>
            <div class="cert-metric">
              <span>РЕЙТИНГ XP</span>
              <strong>${this.xp} XP</strong>
            </div>
            <div class="cert-metric">
              <span>МАКС. СЕРИЯ</span>
              <strong>COMBO x${Math.max(1, this.maxStreak)}</strong>
            </div>
          </div>
        </div>

        <div class="cert-actions-row">
          <button type="button" id="btn-copy-cert" class="quiz-next-btn cert-share-btn">
            📋 Скопировать результат для отправки
          </button>
          <button type="button" id="quiz-restart-btn" class="btn-cert-retry">
            ↻ Пройти заново
          </button>
        </div>
      </div>
    `;

    // Сохранение имени в сертификате
    const nameInput = document.getElementById('cert-keeper-input');
    nameInput?.addEventListener('input', (e) => {
      this.keeperName = e.target.value.trim() || 'Посетитель музея';
      localStorage.setItem('ldpk_keeper_name', this.keeperName);
    });

    // Кнопка копирования / шаринга сертификата
    const copyBtn = document.getElementById('btn-copy-cert');
    copyBtn?.addEventListener('click', async () => {
      const shareText =
        `🏛 Сертификат «Виртуального музея ЛДПК» (${certCode})\n` +
        `👤 Хранитель: ${this.keeperName}\n` +
        `🏅 Звание: ${rankTitle}\n` +
        `📊 Результат: ${score}/${total} (${this.xp} XP, макс. серия x${Math.max(1, this.maxStreak)})`;

      try {
        await navigator.clipboard.writeText(shareText);
        copyBtn.textContent = '✓ Результат скопирован в буфер обмена!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Скопировать результат для отправки';
        }, 2800);
      } catch (e) {}
    });

    document.getElementById('quiz-restart-btn')?.addEventListener('click', () => {
      this.xp = 0;
      this.streak = 0;
      this.maxStreak = 0;
      this.app.quizCurrentIndex = 0;
      this.app.quizScore = 0;
      this.renderBattleStep();
    });

    // Запускаем победный аккорд и конфетти при высоком результате
    if (ratio >= 0.6) {
      this.playVictoryFanfare();
      this.launchConfettiCanvas();
    }
  }

  launchConfettiCanvas() {
    const canvas = document.getElementById('quiz-confetti-canvas');
    if (!canvas || document.body.classList.contains('lite-mode')) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 560;
    canvas.height = canvas.parentElement.clientHeight || 380;

    const colors = ['#38bdf8', '#fbbf24', '#10b981', '#c084fc', '#f87171'];
    const pieces = Array.from({ length: 65 }, () => ({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 120,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -4 - Math.random() * 6,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vRot: (Math.random() - 0.5) * 0.2,
      alpha: 1
    }));

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // Гравитация
        p.rot += p.vRot;
        p.alpha = Math.max(0, 1 - frame / 110);

        if (p.alpha > 0.02) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /* ==========================================================================
     ТАКТИЛЬНЫЙ АУДИО-СИНТЕЗАТОР ВИКТОРИНЫ (WEB AUDIO API)
     ========================================================================== */
  ensureAudio() {
    if (localStorage.getItem('museum_sfx_muted') === 'true') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!this.audioCtx && AudioCtx) this.audioCtx = new AudioCtx();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  playAnswerSfx(isCorrect) {
    const ctx = this.ensureAudio();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (isCorrect) {
        // Победный восходящий синтез с повышением тона от комбо
        const pitchBoost = Math.min(300, this.streak * 45);
        [523.25 + pitchBoost, 659.25 + pitchBoost, 783.99 + pitchBoost].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.055);
          gain.gain.setValueAtTime(0.06, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.24);
        });
      } else {
        // Тактильный низкий баззер ошибки
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.linearRampToValueAtTime(115, now + 0.28);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      }
    } catch (e) {}
  }

  playTickSfx() {
    const ctx = this.ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } catch (e) {}
  }

  playVictoryFanfare() {
    const ctx = this.ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.05, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.08 + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.7);
      });
    } catch (e) {}
  }
}

/* ==========================================================================
   ГОЛОГРАФИЧЕСКИЙ СКАНЕР ЭКСПОНАТА (X-RAY HOLOGRAM INSPECTOR)
   ========================================================================== */
export class HologramXRayInspector {
  constructor(appInstance) {
    this.app = appInstance;
    this.isActive = false;
    this.audioCtx = null;
    this.init();
  }

  init() {
    const headerBar = document.querySelector('.drawer-header-bar');
    const mediaBox = document.querySelector('.drawer-media-box');
    if (!headerBar || !mediaBox || document.getElementById('btn-xray-scanner')) return;

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.type = 'button';
    this.toggleBtn.id = 'btn-xray-scanner';
    this.toggleBtn.className = 'xray-toggle-btn';
    this.toggleBtn.innerHTML = `<span class="xray-led"></span><span>РЕНТГЕН-СКАНЕР</span>`;
    this.toggleBtn.addEventListener('click', () => this.toggleScanner());

    const closeBtn = document.getElementById('drawer-close');
    headerBar.insertBefore(this.toggleBtn, closeBtn);

    this.overlay = document.createElement('div');
    this.overlay.id = 'xray-hologram-overlay';
    this.overlay.className = 'xray-hologram-overlay';
    this.overlay.innerHTML = `
      <div class="xray-scanline-laser"></div>
      <div class="xray-grid-mesh"></div>
      <div class="xray-telemetry-hud">
        <span>SPECTRAL_ANALYSIS // ACTIVE</span>
        <span id="xray-epoch-code">DEPTH_SCAN: 99.4%</span>
      </div>
      <div id="xray-hotspots-container" class="xray-hotspots-container"></div>
    `;

    mediaBox.appendChild(this.overlay);
    this.hotspotsContainer = document.getElementById('xray-hotspots-container');
    this.mediaBox = mediaBox;
  }

  toggleScanner(forceState) {
    this.isActive = typeof forceState === 'boolean' ? forceState : !this.isActive;
    if (!this.toggleBtn || !this.overlay) return;

    this.toggleBtn.classList.toggle('active', this.isActive);
    this.overlay.classList.toggle('active', this.isActive);
    this.mediaBox.classList.toggle('xray-mode-active', this.isActive);

    if (this.isActive) {
      this.renderSpotAnnotations(this.app?.currentSpot);
    }
  }

  renderSpotAnnotations(spot) {
    if (!this.hotspotsContainer || !spot) return;
    this.hotspotsContainer.innerHTML = '';

    const baseAnnotations = (spot.extraInfo && spot.extraInfo.length > 0)
      ? spot.extraInfo.map((info) => ({ label: info.label, value: info.value }))
      : [{ label: 'Эпоха', value: spot.epoch || 'XX–XXI вв.' }];

    const notes = [...baseAnnotations, { label: 'Статус фонда', value: 'Подлинник ЛДПК' }].slice(0, 3);
    const coords = [
      { x: 24, y: 34, side: 'right' },
      { x: 68, y: 46, side: 'left' },
      { x: 38, y: 74, side: 'right' }
    ];

    notes.forEach((note, idx) => {
      const pos = coords[idx % coords.length];
      const node = document.createElement('div');
      node.className = `xray-annotation-node side-${pos.side}`;
      node.style.left = `${pos.x}%`;
      node.style.top = `${pos.y}%`;
      node.innerHTML = `
        <button type="button" class="xray-target-pin"><span class="pin-ring"></span><span class="pin-core"></span></button>
        <div class="xray-callout-box">
          <div class="xray-callout-content">
            <span class="xray-callout-label">${note.label}</span>
            <strong class="xray-callout-val">${note.value}</strong>
          </div>
        </div>
      `;
      this.hotspotsContainer.appendChild(node);
    });
  }
}

/* ==========================================================================
   ЕДИНАЯ ТОЧКА ПОДКЛЮЧЕНИЯ К MUSEUMAPP
   ========================================================================== */
export function initDigitalTwinAndScanner(appInstance) {
  const digitalTwinMap = new Museum3DMap(appInstance);
  const chronoArchive = new ChronoArchiveHub(appInstance);
  const quizBattle = new QuizBattleHUD(appInstance);
  const xrayInspector = new HologramXRayInspector(appInstance);

  if (!appInstance) {
    return { digitalTwinMap, chronoArchive, quizBattle, xrayInspector };
  }

  // Синхронизация 3D-карты и маяка «ВЫ ЗДЕСЬ» при открытии плана
  const origOpenMap = appInstance.openMap.bind(appInstance);
  appInstance.openMap = function () {
    origOpenMap();
    digitalTwinMap.rebuildVitrineObelisks();
    digitalTwinMap.highlightActiveHall(appInstance.currentHall?.id);
    digitalTwinMap.animateCameraToDefault();
    digitalTwinMap.syncRenderMode();
  };

  const origCloseMap = appInstance.closeMap.bind(appInstance);
  appInstance.closeMap = function () {
    origCloseMap();
    digitalTwinMap.stopLoop();
  };

  // Автоматическое перемещение маяка «ВЫ ЗДЕСЬ» при смене зала в шапке
  const origFinishHall = appInstance.finishHallTransition.bind(appInstance);
  appInstance.finishHallTransition = function (hall, targetVitrineId = null) {
    origFinishHall(hall, targetVitrineId);
    digitalTwinMap.highlightActiveHall(hall.id);
  };

  return { digitalTwinMap, chronoArchive, quizBattle, xrayInspector };
}