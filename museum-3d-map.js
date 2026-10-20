// museum-3d-map.js
/**
 * МОДУЛИ 2, 3, 4:
 * - Museum3DMap (Three.js r128 Architectural Clay & Modern Gallery Digital Twin):
 *   Матовый архитектурный гипс слоновой кости, рельефные карнизы, мягкий свет залов,
 *   латунные музейные тумбы витрин, маяк «ВЫ ЗДЕСЬ» (Sprite) и плавный перелёт с открытием витрины.
 * - ChronoArchiveCatalogV2 (Каталог 2.0):
 *   Режимы «Галерея» (3D-Tilt) и «Хронологическая ось (Timeline 1941–2026)»,
 *   живой поиск по названию/описанию/тегам (ЛиАЗ, арифмометр, фарфор, война), фильтры «Все» / «Только с 3D».
 * - NobleQuizV2 (Викторина 2.0):
 *   Римская нумерация (I, II, III, IV, V), латунный прогресс-бар, тактильный изумруд/терракот,
 *   историческая справка и именная «Грамота знатока истории ЛДПК» с печатью музея.
 */

import { globalSoundEngine, globalGalleryEnv } from './visual-sound.js';

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ==========================================================================
   МОДУЛЬ 2: ЧЕСТНЫЙ ИЗОМЕТРИЧЕСКИЙ 3D-ПЛАН ЗДАНИЯ НА THREE.JS (ARCHITECTURAL CLAY)
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

    this.roomGroups = new Map();
    this.pedestalItems = [];
    this.hitboxMeshes = [];
    this.hoveredPedestal = null;
    this.cameraTween = null;

    this.userBeacon = {
      group: null,
      pulseRing1: null,
      pulseRing2: null,
      beam: null,
      sprite: null,
      targetPos: null
    };

    // Архитектурная экспликация залов с благородной интерьерной подсветкой
    this.hallSpecs = {
      'college-history': {
        x: 20, y: 20, w: 380, h: 230, wallH: 46,
        lightColor: 0xd4af37, // Благородный золотой
        floorTint: 0xede6d8,
        title: 'I. ИСТОРИЯ ЛДПК'
      },
      'achievements': {
        x: 20, y: 260, w: 155, h: 520, wallH: 46,
        lightColor: 0x9b89b3, // Приглушённая лаванда
        floorTint: 0xe8e4ec,
        title: 'IV. ДОСТИЖЕНИЯ'
      },
      'region-history': {
        x: 185, y: 260, w: 215, h: 280, wallH: 46,
        lightColor: 0x6d93a8, // Серо-голубой дулёвский
        floorTint: 0xe3e9ec,
        title: 'II. БЫТ И КУЛЬТУРА'
      },
      'military-glory': {
        x: 185, y: 550, w: 215, h: 230, wallH: 46,
        lightColor: 0xa64b4b, // Глубокий бордо
        floorTint: 0xece3e1,
        title: 'III. ВОЕННАЯ ПАМЯТЬ'
      }
    };

    this.init();
  }

  async init() {
    if (!this.wrapper) return;
    this.mountStageDOM();

    try {
      await loadScriptOnce(THREE_CDN);
      await loadScriptOnce(ORBIT_CDN);
      this.initThreeEngine();
      this.buildArchitecturalClayModel();
      this.buildHereBeacon();
      this.rebuildBrassPedestals();
      this.bindEvents();
      this.isReady = true;
      this.syncRenderMode();
    } catch (err) {
      console.warn('[Museum3DMap]: Переключение на 2D SVG план.', err);
      this.force2D = true;
      this.syncRenderMode();
    }
  }

  mountStageDOM() {
    this.wrapper.classList.add('digital-twin-stage', 'clay-maquette-stage');

    this.canvasHost = document.createElement('div');
    this.canvasHost.id = 'three-map-host';
    this.canvasHost.className = 'three-map-host';
    this.wrapper.appendChild(this.canvasHost);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'three-vitrine-tooltip clay-tooltip hidden';
    this.wrapper.appendChild(this.tooltipEl);

    const headerTools = document.querySelector('.map-header-tools');
    if (headerTools && !document.getElementById('btn-toggle-webgl-map')) {
      const modeBtn = document.createElement('button');
      modeBtn.type = 'button';
      modeBtn.id = 'btn-toggle-webgl-map';
      modeBtn.className = 'btn-map-tool active';
      modeBtn.textContent = '🏛 3D Макет';
      modeBtn.addEventListener('click', () => {
        this.force2D = !this.force2D;
        modeBtn.classList.toggle('active', !this.force2D);
        modeBtn.textContent = this.force2D ? '📐 2D Чертёж' : '🏛 3D Макет';
        this.syncRenderMode();
      });
      headerTools.insertBefore(modeBtn, headerTools.firstChild);
    }

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'three-reset-cam-btn';
    resetBtn.textContent = '⟲ Общий вид макета';
    resetBtn.addEventListener('click', () => this.resetCameraView());
    this.canvasHost.appendChild(resetBtn);
  }

  initThreeEngine() {
    const THREE = window.THREE;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181614);
    this.scene.fog = new THREE.FogExp2(0x181614, 0.00055);

    const w = this.wrapper.clientWidth || 920;
    const h = this.wrapper.clientHeight || 520;

    // Изометрическая перспектива с малым углом обзора (эффект архитектурного макета)
    this.camera = new THREE.PerspectiveCamera(28, w / h, 10, 4000);
    this.camera.position.set(-540, 760, 680);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.canvasHost.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.25;
    this.controls.minPolarAngle = 0.25;
    this.controls.minDistance = 260;
    this.controls.maxDistance = 1450;
    this.controls.target.set(0, 12, 0);

    this.raycaster = new THREE.Raycaster();

    // Мягкий студийный свет для архитектурного гипса
    const hemiLight = new THREE.HemisphereLight(0xfff8eb, 0x2a2521, 0.88);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff3df, 0.72);
    sunLight.position.set(320, 680, 420);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1800;
    const d = 520;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    // Подмакетная архитектурная плита (тёмный сланец с латунной рамкой)
    const baseBoardGeo = new THREE.BoxGeometry(500, 10, 880);
    const baseBoardMat = new THREE.MeshStandardMaterial({
      color: 0x221f1c,
      roughness: 0.85,
      metalness: 0.08
    });
    const baseBoard = new THREE.Mesh(baseBoardGeo, baseBoardMat);
    baseBoard.position.y = -5.5;
    baseBoard.receiveShadow = true;
    this.scene.add(baseBoard);

    const trimEdges = new THREE.EdgesGeometry(baseBoardGeo);
    const trimMat = new THREE.LineBasicMaterial({ color: 0xc5a059, transparent: true, opacity: 0.45 });
    const trimLine = new THREE.LineSegments(trimEdges, trimMat);
    trimLine.position.y = -5.5;
    this.scene.add(trimLine);
  }

  planToWorld(px, py) {
    return { wx: px - 210, wz: py - 400 };
  }

  /**
   * Строит 3D-макет залов из матового архитектурного гипса с рельефными фасками и карнизами
   */
  buildArchitecturalClayModel() {
    const THREE = window.THREE;

    // Материал матового гипса слоновой кости (Architectural Clay)
    const clayWallMat = new THREE.MeshStandardMaterial({
      color: 0xf2ece1,
      roughness: 0.88,
      metalness: 0.03
    });

    const chamferTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe2d9c8,
      roughness: 0.78,
      metalness: 0.08
    });

    Object.entries(this.hallSpecs).forEach(([hallId, spec]) => {
      const group = new THREE.Group();
      const cx = spec.x + spec.w / 2;
      const cy = spec.y + spec.h / 2;
      const { wx, wz } = this.planToWorld(cx, cy);
      group.position.set(wx, 0, wz);

      // 1. Матовая гипсовая плита пола зала
      const floorGeo = new THREE.BoxGeometry(spec.w - 4, 4, spec.h - 4);
      const floorMat = new THREE.MeshStandardMaterial({
        color: spec.floorTint,
        roughness: 0.82,
        metalness: 0.05
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.y = 2;
      floorMesh.receiveShadow = true;
      floorMesh.userData = { type: 'hall', hallId };
      group.add(floorMesh);

      // 2. Объёмные стены по периметру зала с фасками (толщина стены 7 ед.)
      const wallT = 7;
      const wallH = spec.wallH;

      const createWallSegment = (w, h, d, x, z) => {
        const wallGroup = new THREE.Group();
        wallGroup.position.set(x, 0, z);

        // Основное тело гипсовой стены
        const bodyGeo = new THREE.BoxGeometry(w, h, d);
        const bodyMesh = new THREE.Mesh(bodyGeo, clayWallMat);
        bodyMesh.position.y = h / 2 + 2;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        bodyMesh.userData = { type: 'hall', hallId };
        wallGroup.add(bodyMesh);

        // Верхний рельефный карниз (фаска)
        const capGeo = new THREE.BoxGeometry(w + 2.4, 3.2, d + 2.4);
        const capMesh = new THREE.Mesh(capGeo, chamferTrimMat);
        capMesh.position.y = h + 2.5;
        wallGroup.add(capMesh);

        // Нижний плинтус
        const plinthGeo = new THREE.BoxGeometry(w + 1.6, 4, d + 1.6);
        const plinthMesh = new THREE.Mesh(plinthGeo, chamferTrimMat);
        plinthMesh.position.y = 4;
        wallGroup.add(plinthMesh);

        group.add(wallGroup);
      };

      // Северная, Южная, Западная и Восточная стены (с учётом открытого обзора сверху)
      createWallSegment(spec.w, wallH, wallT, 0, -spec.h / 2 + wallT / 2);
      createWallSegment(spec.w, wallH * 0.42, wallT, 0, spec.h / 2 - wallT / 2);
      createWallSegment(wallT, wallH, spec.h, -spec.w / 2 + wallT / 2, 0);
      createWallSegment(wallT, wallH * 0.42, spec.h, spec.w / 2 - wallT / 2, 0);

      // 3. Мягкий интерьерный источник света внутри зала
      const roomLight = new THREE.PointLight(spec.lightColor, 1.15, 360, 1.6);
      roomLight.position.set(0, wallH * 0.85, 0);
      group.add(roomLight);

      // 4. Архитектурная табличка с названием зала
      const labelSprite = this.createArchitecturalLabel(spec.title, spec.lightColor);
      labelSprite.position.set(0, wallH + 22, -spec.h * 0.28);
      group.add(labelSprite);

      this.scene.add(group);
      this.roomGroups.set(hallId, { group, floorMesh, floorMat, roomLight, spec });
    });
  }

  createArchitecturalLabel(text, hexColor) {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(244, 239, 230, 0.95)';
    ctx.strokeStyle = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 12, 492, 72, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 24px Georgia, serif';
    ctx.fillStyle = '#1f1c18';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(126, 24, 1);
    return sprite;
  }

  /**
   * Создаёт изумрудный маяк «ВЫ ЗДЕСЬ» на полу активного зала с вертикальным лучом и Sprite-бейджем
   */
  buildHereBeacon() {
    const THREE = window.THREE;
    const group = new THREE.Group();

    // Изумрудная точка на полу
    const discGeo = new THREE.CircleGeometry(8.5, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 4.6;
    group.add(disc);

    // Расходящиеся пульсирующие кольца
    const makeRing = () => {
      const geo = new THREE.RingGeometry(8.5, 11.5, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 4.5;
      group.add(mesh);
      return { mesh, mat };
    };

    const pulseRing1 = makeRing();
    const pulseRing2 = makeRing();

    // Мягкий вертикальный световой луч
    const beamGeo = new THREE.CylinderGeometry(1.0, 5.5, 76, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 42;
    group.add(beam);

    // Парящий билборд-бейдж «ВЫ ЗДЕСЬ» (Sprite), который всегда смотрит в камеру
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(20, 48, 38, 0.96)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(12, 10, 296, 64, 32);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(52, 42, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillStyle = '#f4efe6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ВЫ ЗДЕСЬ', 76, 43);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(84, 25, 1);
    sprite.position.set(0, 86, 0);
    sprite.renderOrder = 999;
    group.add(sprite);

    this.scene.add(group);
    this.userBeacon = {
      group,
      pulseRing1,
      pulseRing2,
      beam,
      sprite,
      targetPos: new THREE.Vector3(0, 0, 0)
    };

    this.updateBeaconHall(this.app?.currentHall?.id || 'college-history', true);
  }

  updateBeaconHall(hallId, instant = false) {
    if (!this.userBeacon.group || !window.THREE) return;
    const spec = this.hallSpecs[hallId] || this.hallSpecs['college-history'];
    const px = spec.x + spec.w * 0.22;
    const py = spec.y + spec.h * 0.30;
    const { wx, wz } = this.planToWorld(px, py);

    this.userBeacon.targetPos.set(wx, 0, wz);
    if (instant) {
      this.userBeacon.group.position.copy(this.userBeacon.targetPos);
    }
  }

  /**
   * Размещает на координатах витрин латунные/золотые музейные постаменты-тумбы с микро-подсветкой
   */
  rebuildBrassPedestals() {
    if (!this.scene || !window.THREE) return;
    const THREE = window.THREE;

    this.pedestalItems.forEach((p) => this.scene.remove(p.holder));
    this.pedestalItems = [];
    this.hitboxMeshes = [];

    const halls = this.app?.data?.halls || [];

    halls.forEach((hall) => {
      const spec = this.hallSpecs[hall.id];
      if (!spec) return;

      (hall.hotspots || []).forEach((spot, idx) => {
        const relX = spot.mapX !== undefined ? spot.mapX : spot.x;
        const relY = spot.mapY !== undefined ? spot.mapY : spot.y;

        const px = spec.x + (relX / 100) * spec.w;
        const py = spec.y + (relY / 100) * spec.h;
        const { wx, wz } = this.planToWorld(px, py);

        const holder = new THREE.Group();
        holder.position.set(wx, 4, wz);

        const payload = {
          type: 'vitrine',
          hallId: hall.id,
          hallName: hall.name,
          spot,
          index: idx + 1
        };

        // 1. Подвижная музейная тумба-постамент (гипсовая колонна + латунная капитель)
        const pedestalGroup = new THREE.Group();

        const baseGeo = new THREE.BoxGeometry(16, 18, 16);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0xf4efe6,
          roughness: 0.7,
          metalness: 0.08
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 9;
        baseMesh.castShadow = true;
        pedestalGroup.add(baseMesh);

        // Латунная верхняя плита постамента
        const brassTopGeo = new THREE.BoxGeometry(18.5, 3.5, 18.5);
        const brassTopMat = new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          emissive: 0x8a6d1b,
          emissiveIntensity: 0.35,
          roughness: 0.28,
          metalness: 0.85
        });
        const brassTop = new THREE.Mesh(brassTopGeo, brassTopMat);
        brassTop.position.y = 19.5;
        pedestalGroup.add(brassTop);

        // Миниатюрный золотой артефакт на постаменте
        const relicGeo = new THREE.OctahedronGeometry(5.5, 0);
        const relicMat = new THREE.MeshStandardMaterial({
          color: 0xfff3d1,
          emissive: 0xc5a059,
          emissiveIntensity: 0.5,
          roughness: 0.2,
          metalness: 0.9
        });
        const relicMesh = new THREE.Mesh(relicGeo, relicMat);
        relicMesh.position.y = 27;
        pedestalGroup.add(relicMesh);

        holder.add(pedestalGroup);

        // 2. Тёплый световой ореол вокруг постамента на полу
        const haloGeo = new THREE.RingGeometry(10, 14.5, 28);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xd4af37,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55
        });
        const haloRing = new THREE.Mesh(haloGeo, haloMat);
        haloRing.rotation.x = -Math.PI / 2;
        haloRing.position.y = 0.4;
        holder.add(haloRing);

        // 3. Номер витрины в латунном медальоне
        const badgeSprite = this.createPedestalNumberBadge(idx + 1);
        badgeSprite.position.set(0, 40, 0);
        holder.add(badgeSprite);

        // 4. Невидимый хитбокс для удобного Raycasting
        const hitGeo = new THREE.BoxGeometry(28, 44, 28);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.y = 22;
        holder.add(hitbox);

        const itemRef = {
          holder,
          pedestalGroup,
          brassTopMat,
          relicMesh,
          haloRing,
          haloMat,
          payload,
          currentLift: 0
        };

        hitbox.userData = { itemRef };
        baseMesh.userData = { itemRef };
        brassTop.userData = { itemRef };

        this.scene.add(holder);
        this.pedestalItems.push(itemRef);
        this.hitboxMeshes.push(hitbox, baseMesh, brassTop);
      });
    });
  }

  createPedestalNumberBadge(num) {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e1b18';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 25px Georgia, serif';
    ctx.fillStyle = '#f4efe6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 32, 33);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(15, 15, 1);
    return sprite;
  }

  highlightActiveHall(activeHallId) {
    this.roomGroups.forEach((r, hallId) => {
      const isCurrent = hallId === activeHallId;
      r.roomLight.intensity = isCurrent ? 1.85 : 0.75;
      r.floorMat.emissive = new window.THREE.Color(isCurrent ? r.spec.lightColor : 0x000000);
      r.floorMat.emissiveIntensity = isCurrent ? 0.12 : 0;
    });
    this.updateBeaconHall(activeHallId, false);
  }

  bindEvents() {
    const domEl = this.renderer.domElement;

    const updateMouse = (e) => {
      const rect = domEl.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return { lx: e.clientX - rect.left, ly: e.clientY - rect.top };
    };

    domEl.addEventListener('pointermove', (e) => {
      const { lx, ly } = updateMouse(e);
      this.checkRaycastHover(lx, ly);
    });

    let downPt = { x: 0, y: 0, t: 0 };
    domEl.addEventListener('pointerdown', (e) => {
      downPt = { x: e.clientX, y: e.clientY, t: performance.now() };
      updateMouse(e);
    });

    domEl.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
      if (dist > 12 || performance.now() - downPt.t > 600) return;
      updateMouse(e);
      this.handleMapClick();
    });

    window.addEventListener('resize', () => this.handleResize());

    const liteObs = new MutationObserver(() => this.syncRenderMode());
    liteObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  checkRaycastHover(lx, ly) {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.hitboxMeshes, false);
    if (hits.length > 0) {
      const itemRef = hits[0].object.userData?.itemRef;
      if (itemRef) {
        this.hoveredPedestal = itemRef;
        this.renderer.domElement.style.cursor = 'pointer';

        const { spot, index, hallName } = itemRef.payload;
        this.tooltipEl.innerHTML = `
          <span class="tt-hall">${hallName} • ВИТРИНА №${index}</span>
          <strong class="tt-title">${spot.title}</strong>
          <span class="tt-epoch">${spot.epoch || 'Фонд музея'} — Нажмите для перехода к витрине</span>
        `;
        this.tooltipEl.style.left = `${lx}px`;
        this.tooltipEl.style.top = `${ly - 18}px`;
        this.tooltipEl.classList.remove('hidden');
        return;
      }
    }

    this.hoveredPedestal = null;
    this.renderer.domElement.style.cursor = 'grab';
    this.tooltipEl.classList.add('hidden');
  }

  handleMapClick() {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.hitboxMeshes, false);
    const chosen = hits[0]?.object?.userData?.itemRef || this.hoveredPedestal;

    if (chosen) {
      globalSoundEngine?.playNobleClick();
      const { hallId, spot } = chosen.payload;
      const targetWorld = chosen.holder.position.clone();
      this.tooltipEl.classList.add('hidden');

      this.flyToTarget(targetWorld, async () => {
        await this.teleportAndOpenVitrine(hallId, spot);
      });
      return;
    }

    // Проверка клика по полу зала для перехода в зал
    const floorMeshes = [];
    this.roomGroups.forEach((r) => floorMeshes.push(r.floorMesh));
    const roomHits = this.raycaster.intersectObjects(floorMeshes, false);

    if (roomHits.length > 0) {
      const { hallId } = roomHits[0].object.userData;
      const rData = this.roomGroups.get(hallId);
      if (rData) {
        globalSoundEngine?.playNobleClick();
        this.flyToTarget(rData.group.position.clone(), async () => {
          this.app.closeMap();
          if (this.app.currentHall?.id !== hallId) {
            await this.app.switchHall(hallId);
          }
        });
      }
    }
  }

  async teleportAndOpenVitrine(hallId, spot) {
    if (!this.app || !spot) return;
    this.app.closeMap();
    this.stopLoop();

    if (this.app.currentHall?.id === hallId && !this.app.isTransitioning) {
      const targetSpot = this.app.currentHall.hotspots?.find((s) => s.id === spot.id) || spot;
      setTimeout(() => this.app.openVitrineDrawer(targetSpot), 100);
      return;
    }

    this.app.isTransitioning = false;
    await this.app.switchHall(hallId, spot.id);

    setTimeout(() => {
      if (this.app.dom?.drawer && !this.app.dom.drawer.classList.contains('active')) {
        const hallObj = this.app.data?.halls?.find((h) => h.id === hallId);
        const foundSpot = hallObj?.hotspots?.find((s) => s.id === spot.id) || spot;
        this.app.openVitrineDrawer(foundSpot);
      }
    }, 420);
  }

  flyToTarget(vec, onComplete) {
    this.cameraTween = {
      startTime: performance.now(),
      duration: 560,
      startCam: this.camera.position.clone(),
      endCam: new window.THREE.Vector3(vec.x - 120, 175, vec.z + 160),
      startTarget: this.controls.target.clone(),
      endTarget: new window.THREE.Vector3(vec.x, 20, vec.z),
      onComplete
    };
  }

  resetCameraView() {
    if (!window.THREE || !this.camera) return;
    this.cameraTween = {
      startTime: performance.now(),
      duration: 520,
      startCam: this.camera.position.clone(),
      endCam: new window.THREE.Vector3(-540, 760, 680),
      startTarget: this.controls.target.clone(),
      endTarget: new window.THREE.Vector3(0, 12, 0),
      onComplete: null
    };
  }

  handleResize() {
    if (!this.renderer || !this.camera || !this.wrapper) return;
    const w = this.wrapper.clientWidth || 920;
    const h = Math.max(440, this.wrapper.clientHeight || 520);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  syncRenderMode() {
    const isLite = document.body.classList.contains('lite-mode');
    const use2D = isLite || this.force2D || !this.isReady;

    if (this.svgFallback) this.svgFallback.style.display = use2D ? 'block' : 'none';
    if (this.canvasHost) this.canvasHost.style.display = use2D ? 'none' : 'block';

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
    this.renderFrame();
  }

  stopLoop() {
    this.isRendering = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderFrame() {
    if (!this.isRendering) return;
    const t = this.clock ? this.clock.getElapsedTime() : performance.now() * 0.001;

    if (this.cameraTween) {
      const p = Math.min(1, (performance.now() - this.cameraTween.startTime) / this.cameraTween.duration);
      const ease = 1 - Math.pow(1 - p, 3);
      this.camera.position.lerpVectors(this.cameraTween.startCam, this.cameraTween.endCam, ease);
      this.controls.target.lerpVectors(this.cameraTween.startTarget, this.cameraTween.endTarget, ease);
      if (p >= 1) {
        const cb = this.cameraTween.onComplete;
        this.cameraTween = null;
        if (cb) cb();
      }
    }

    // Пульсация маяка «ВЫ ЗДЕСЬ»
    if (this.userBeacon.group) {
      this.userBeacon.group.position.lerp(this.userBeacon.targetPos, 0.09);
      const w1 = (t * 0.75) % 1;
      const w2 = (t * 0.75 + 0.5) % 1;

      this.userBeacon.pulseRing1.mesh.scale.setScalar(1 + w1 * 3.0);
      this.userBeacon.pulseRing1.mat.opacity = (1 - w1) * 0.75;

      this.userBeacon.pulseRing2.mesh.scale.setScalar(1 + w2 * 3.0);
      this.userBeacon.pulseRing2.mat.opacity = (1 - w2) * 0.75;

      this.userBeacon.sprite.position.y = 85 + Math.sin(t * 2.8) * 3;
    }

    // Плавный подъём и подсветка тумбы витрины при наведении
    this.pedestalItems.forEach((item, idx) => {
      const isHovered = this.hoveredPedestal === item;
      const targetLift = isHovered ? 7.5 : 0;
      item.currentLift += (targetLift - item.currentLift) * 0.16;
      item.pedestalGroup.position.y = item.currentLift;

      item.brassTopMat.emissiveIntensity = isHovered ? 1.1 : 0.32;
      item.haloMat.opacity = isHovered ? 0.9 : 0.45;
      item.relicMesh.rotation.y = t * (isHovered ? 2.6 : 0.9) + idx;
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(() => this.renderFrame());
  }
}

/* ==========================================================================
   МОДУЛЬ 3: РАЗДЕЛ «ВСЕ ЭКСПОНАТЫ» (КАТАЛОГ 2.0 — ГАЛЕРЕЯ 3D-TILT & TIMELINE)
   ========================================================================== */
export class ChronoArchiveCatalogV2 {
  constructor(appInstance) {
    this.app = appInstance;
    this.viewMode = 'gallery'; // 'gallery' | 'timeline'
    this.searchQuery = '';
    this.only3D = false;

    this.quickTags = ['ЛиАЗ', 'арифмометр', 'фарфор', 'война', 'Профессионалитет'];
    this.init();
  }

  init() {
    this.mountCatalogToolbar();
    this.overrideAppCatalogRender();
  }

  mountCatalogToolbar() {
    const sheetHeader = document.querySelector('#catalog-sheet .sheet-header');
    if (!sheetHeader || document.getElementById('chrono-archive-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'chrono-archive-toolbar';
    toolbar.className = 'chrono-archive-toolbar';

    const quickTagsHtml = this.quickTags.map((tag) =>
      `<button type="button" class="quick-search-tag" data-q="${tag}">#${tag}</button>`
    ).join('');

    toolbar.innerHTML = `
      <!-- Живой поиск + быстрые теги -->
      <div class="archive-search-wrap">
        <div class="archive-search-box">
          <svg class="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="search" id="archive-live-search" class="archive-search-input"
                 placeholder="Поиск по названию, описанию и тегам (ЛиАЗ, арифмометр, фарфор, война)...">
          <span id="archive-found-counter" class="archive-found-badge">0</span>
        </div>
        <div class="quick-tags-row" id="quick-tags-row">
          <span class="quick-tags-label">Теги:</span>
          ${quickTagsHtml}
        </div>
      </div>

      <!-- Фильтры «Все» / «Только с 3D» и Переключатель «Галерея» / «Хронологическая ось» -->
      <div class="archive-controls-group">
        <div class="archive-smart-tags" id="archive-3d-filter">
          <button type="button" class="smart-tag-btn active" data-3d="all">Все экспонаты</button>
          <button type="button" class="smart-tag-btn" data-3d="only3d">🧊 Только с 3D</button>
        </div>

        <div class="view-mode-segmented" id="archive-view-switcher">
          <button type="button" class="view-seg-btn active" data-view="gallery">🖼 Галерея</button>
          <button type="button" class="view-seg-btn" data-view="timeline">⏳ Хронологическая ось (1941–2026)</button>
        </div>
      </div>
    `;

    sheetHeader.insertAdjacentElement('afterend', toolbar);

    const searchInput = document.getElementById('archive-live-search');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.syncQuickTagHighlight();
      this.app.renderCatalogItems();
    });

    // Быстрые теги (ЛиАЗ, арифмометр, фарфор, война...)
    document.getElementById('quick-tags-row').addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-search-tag');
      if (!btn) return;
      const tagVal = btn.getAttribute('data-q') || '';
      if (searchInput.value.toLowerCase() === tagVal.toLowerCase()) {
        searchInput.value = '';
        this.searchQuery = '';
      } else {
        searchInput.value = tagVal;
        this.searchQuery = tagVal.toLowerCase();
      }
      this.syncQuickTagHighlight();
      this.app.renderCatalogItems();
    });

    // Фильтр «Все» / «Только с 3D»
    document.getElementById('archive-3d-filter').addEventListener('click', (e) => {
      const btn = e.target.closest('.smart-tag-btn');
      if (!btn) return;
      document.querySelectorAll('#archive-3d-filter .smart-tag-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      this.only3D = btn.getAttribute('data-3d') === 'only3d';
      this.app.renderCatalogItems();
    });

    // Переключатель «Галерея» / «Хронологическая ось (Timeline)»
    document.getElementById('archive-view-switcher').addEventListener('click', (e) => {
      const btn = e.target.closest('.view-seg-btn');
      if (!btn) return;
      document.querySelectorAll('#archive-view-switcher .view-seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      this.viewMode = btn.getAttribute('data-view') || 'gallery';
      this.app.renderCatalogItems();
    });
  }

  syncQuickTagHighlight() {
    document.querySelectorAll('.quick-search-tag').forEach((btn) => {
      const q = (btn.getAttribute('data-q') || '').toLowerCase();
      btn.classList.toggle('active', Boolean(this.searchQuery && this.searchQuery === q));
    });
  }

  extractChronoYear(epoch = '') {
    const m = epoch.match(/(19\d{2}|20\d{2})/);
    if (m) return parseInt(m[1], 10);
    if (epoch.includes('XIX')) return 1941; // В начале шкалы 1941–2026 с пометкой реликвий XIX в.
    if (epoch.toLowerCase().includes('современ')) return 2026;
    return 1970;
  }

  overrideAppCatalogRender() {
    if (!this.app) return;

    this.app.renderCatalogItems = () => {
      const grid = this.app.dom.catalogGrid;
      if (!grid) return;
      grid.innerHTML = '';

      const halls = this.app.data?.halls || [];
      const items = [];

      halls.forEach((hall) => {
        if (this.app.catalogFilter !== 'all' && this.app.catalogFilter !== hall.id) return;

        (hall.hotspots || []).forEach((spot) => {
          const has3D = Boolean(spot.model3d && spot.model3d.trim() !== '');
          if (this.only3D && !has3D) return;

          if (this.searchQuery) {
            const extraStr = (spot.extraInfo || []).map((i) => `${i.label} ${i.value}`).join(' ');
            const fullText = `${spot.title} ${spot.epoch} ${spot.description} ${spot.audioText || ''} ${hall.name} ${extraStr}`.toLowerCase();
            if (!fullText.includes(this.searchQuery)) return;
          }

          items.push({
            hall,
            spot,
            has3D,
            year: this.extractChronoYear(spot.epoch)
          });
        });
      });

      const counter = document.getElementById('archive-found-counter');
      if (counter) counter.textContent = `${items.length} экспонатов`;

      if (items.length === 0) {
        grid.className = 'catalog-empty-state';
        grid.innerHTML = `
          <div class="empty-archive-box">
            <span class="empty-icon">🏛</span>
            <h3>По вашему запросу экспонатов не найдено</h3>
            <p>Попробуйте сбросить фильтры или выбрать другой поисковый тег.</p>
          </div>
        `;
        return;
      }

      if (this.viewMode === 'timeline') {
        items.sort((a, b) => a.year - b.year);
        this.renderTimeline(grid, items);
      } else {
        this.renderGalleryGrid(grid, items);
      }

      globalGalleryEnv?.bindTiltCards('.catalog-card');
    };
  }

  renderGalleryGrid(container, items) {
    container.className = 'catalog-grid clay-gallery-grid';

    items.forEach(({ hall, spot, has3D }) => {
      const card = document.createElement('div');
      card.className = 'catalog-card clay-gallery-card';

      const imgUrl = (spot.images && spot.images.length > 0)
        ? spot.images[0].url
        : (hall.bgImage || 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80');

      const metaTags = (spot.extraInfo || []).map((info) =>
        `<span class="card-meta-pill">${this.app.escapeHtml(info.label)}: <b>${this.app.escapeHtml(info.value)}</b></span>`
      ).join('');

      card.innerHTML = `
        <div class="card-media-box">
          <img src="${imgUrl}" alt="${this.app.escapeHtml(spot.title)}" class="card-img"
               onerror="this.src='https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'">
          <span class="card-hall-badge">${this.app.escapeHtml(hall.name)}</span>
          ${has3D ? '<span class="card-3d-badge">🧊 3D Модель</span>' : ''}
        </div>
        <div class="card-content">
          <span class="card-epoch">${this.app.escapeHtml(spot.epoch || 'Архивный фонд')}</span>
          <h3 class="card-title">${this.app.escapeHtml(spot.title)}</h3>
          <p class="card-desc">${this.app.escapeHtml(spot.description || '')}</p>
          ${metaTags ? `<div class="card-meta-pills">${metaTags}</div>` : ''}
          <div class="card-action-btn">Перейти к витрине →</div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.app.closeCatalog();
        this.app.teleportToVitrine(hall.id, spot.id);
      });

      container.appendChild(card);
    });
  }

  renderTimeline(container, items) {
    container.className = 'chrono-timeline-wrapper';

    const headerBanner = document.createElement('div');
    headerBanner.className = 'timeline-scale-header';
    headerBanner.innerHTML = `<span>1941 • ОСНОВАНИЕ ДКТ</span><span class="scale-line"></span><span>2026 • ПРОФЕССИОНАЛИТЕТ</span>`;
    container.appendChild(headerBanner);

    const axis = document.createElement('div');
    axis.className = 'chrono-timeline-axis';
    container.appendChild(axis);

    items.forEach(({ hall, spot, has3D, year }, idx) => {
      const node = document.createElement('div');
      node.className = `timeline-node ${idx % 2 === 0 ? 'left' : 'right'}`;

      const imgUrl = (spot.images && spot.images.length > 0)
        ? spot.images[0].url
        : (hall.bgImage || 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80');

      node.innerHTML = `
        <div class="timeline-year-marker">
          <span>${year}</span>
        </div>
        <div class="timeline-card catalog-card">
          <img src="${imgUrl}" alt="${this.app.escapeHtml(spot.title)}" class="timeline-thumb"
               onerror="this.src='https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80'">
          <div class="timeline-card-body">
            <div class="timeline-badges">
              <span class="tl-hall-tag">${this.app.escapeHtml(hall.name)}</span>
              <span class="tl-epoch-tag">${this.app.escapeHtml(spot.epoch)}</span>
              ${has3D ? '<span class="tl-3d-tag">🧊 3D</span>' : ''}
            </div>
            <h3 class="timeline-title">${this.app.escapeHtml(spot.title)}</h3>
            <p class="timeline-desc">${this.app.escapeHtml(spot.description)}</p>
            <span class="timeline-teleport-link">Открыть витрину в зале →</span>
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
   МОДУЛЬ 4: ГЕЙМИФИКАЦИЯ ВИКТОРИНЫ (QUIZ 2.0 — ВВОД Ф.И.О. И ИМЕННАЯ ГРАМОТА)
   ========================================================================== */
export class NobleQuizV2 {
  constructor(appInstance) {
    this.app = appInstance;
    this.romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    this.visitorName = localStorage.getItem('ldpk_diploma_name') || '';
    this.isNameConfirmed = false;
    this.init();
  }

  init() {
    if (!this.app) return;

    const origOpenQuiz = this.app.openQuiz.bind(this.app);
    this.app.openQuiz = () => {
      this.isNameConfirmed = false;
      origOpenQuiz();
    };

    this.app.renderQuizStep = () => this.renderNobleQuizStep();
  }

  toRoman(num) {
    return this.romanNumerals[num - 1] || String(num);
  }

  renderNobleQuizStep() {
    const body = this.app.dom.quizBody;
    if (!body) return;

    const questions = this.app.quizQuestions;
    const total = questions.length;
    const idx = this.app.quizCurrentIndex;

    // Если все вопросы пройдены: сначала спрашиваем Имя и Фамилию, затем выписываем Грамоту
    if (idx >= total) {
      if (!this.isNameConfirmed) {
        this.renderNamePromptScreen(body, total);
      } else {
        this.renderOfficialGramota(body, total);
      }
      return;
    }

    const currentQ = questions[idx];
    const progressPercent = ((idx + 1) / total) * 100;
    const romanCurrent = this.toRoman(idx + 1);
    const romanTotal = this.toRoman(total);

    // 1. Создаём шапку и контейнер вопроса
    body.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.className = 'quiz-v2-progress-header';

    const counterSpan = document.createElement('span');
    counterSpan.className = 'quiz-roman-counter';
    counterSpan.textContent = 'ВОПРОС ' + romanCurrent + ' ИЗ ' + romanTotal;

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'quiz-score-live';
    scoreSpan.textContent = 'Счёт: ' + this.app.quizScore;

    headerRow.appendChild(counterSpan);
    headerRow.appendChild(scoreSpan);
    body.appendChild(headerRow);

    // 2. Золотой прогресс-бар
    const progWrap = document.createElement('div');
    progWrap.className = 'quiz-progress-bar-wrap';
    const progFill = document.createElement('div');
    progFill.className = 'quiz-progress-fill';
    progFill.style.width = progressPercent + '%';
    progWrap.appendChild(progFill);
    body.appendChild(progWrap);

    // 3. Текст вопроса
    const qHeading = document.createElement('h3');
    qHeading.className = 'quiz-question-text';
    qHeading.textContent = currentQ.question;
    body.appendChild(qHeading);

    // 4. Список вариантов ответа (строго через textContent — никаких ${...} на экране!)
    const optionsList = document.createElement('div');
    optionsList.className = 'quiz-options-list';
    const optionBtns = [];

    currentQ.options.forEach((optText, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option-btn noble-opt-btn';

      const romanBadge = document.createElement('span');
      romanBadge.className = 'opt-roman-badge';
      romanBadge.textContent = this.toRoman(i + 1);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'opt-label-text';
      labelSpan.textContent = optText;

      btn.appendChild(romanBadge);
      btn.appendChild(labelSpan);
      optionsList.appendChild(btn);
      optionBtns.push(btn);

      btn.addEventListener('click', () => {
        const isCorrect = i === currentQ.correct;
        optionBtns.forEach((b) => { b.disabled = true; });

        if (isCorrect) {
          btn.classList.add('correct');
          this.app.quizScore++;
          scoreSpan.textContent = 'Счёт: ' + this.app.quizScore;
        } else {
          btn.classList.add('wrong');
          if (optionBtns[currentQ.correct]) {
            optionBtns[currentQ.correct].classList.add('correct');
          }
        }

        globalSoundEngine?.playQuizFeedback(isCorrect);

        feedbackBox.innerHTML = '';
        const expBox = document.createElement('div');
        expBox.className = 'quiz-explanation-box ' + (isCorrect ? 'exp-emerald' : 'exp-terracotta');

        const expHead = document.createElement('div');
        expHead.className = 'exp-header';
        expHead.textContent = isCorrect
          ? '✦ Ответ верный • Историческая справка'
          : '✦ Историческая справка музея';

        const expText = document.createElement('p');
        expText.textContent = currentQ.explanation;

        expBox.appendChild(expHead);
        expBox.appendChild(expText);
        feedbackBox.appendChild(expBox);

        nextBtn.style.display = 'block';
      });
    });

    body.appendChild(optionsList);

    // 5. Блок исторической справки и кнопка следующего шага
    const feedbackBox = document.createElement('div');
    feedbackBox.id = 'quiz-feedback-box';
    feedbackBox.className = 'quiz-feedback-collapse';
    body.appendChild(feedbackBox);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.id = 'quiz-action-next';
    nextBtn.className = 'quiz-next-btn';
    nextBtn.style.display = 'none';
    nextBtn.textContent = idx + 1 === total ? 'Перейти к оформлению Грамоты →' : 'Следующий вопрос →';
    nextBtn.addEventListener('click', () => {
      this.app.quizCurrentIndex++;
      this.renderNobleQuizStep();
    });
    body.appendChild(nextBtn);
  }

  /**
   * Экран ввода Имени и Фамилии перед выдачей именной Грамоты
   */
  renderNamePromptScreen(body, total) {
    const score = this.app.quizScore;
    body.innerHTML = `
      <div class="quiz-name-prompt-box" style="text-align:center; padding: 12px 6px 8px 6px;">
        <div style="font-size: 0.72rem; letter-spacing: 0.16em; color: var(--color-gold-bright); font-weight: 700; margin-bottom: 6px;">
          ВИКТОРИНА ЗАВЕРШЕНА • РЕЗУЛЬТАТ: ${score} ИЗ ${total}
        </div>
        <h3 style="font-family: var(--font-display); font-size: 1.65rem; color: var(--color-ivory); margin-bottom: 8px;">
          Оформление именной Грамоты
        </h3>
        <p style="font-size: 0.86rem; color: var(--color-text-muted); max-width: 440px; margin: 0 auto 18px auto; line-height: 1.5;">
          Введите ваши Имя и Фамилию, чтобы музей вписал их в официальную Грамоту знатока истории ЛДПК:
        </p>

        <div style="max-width: 380px; margin: 0 auto 20px auto;">
          <input type="text" id="quiz-visitor-fullname"
                 value="${this.app.escapeHtml(this.visitorName)}"
                 placeholder="Например: Илья Мазанов"
                 maxlength="48"
                 style="width: 100%; padding: 13px 16px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1.5px solid var(--color-gold); color: var(--color-ivory); font-size: 1rem; font-weight: 600; text-align: center; outline: none;">
        </div>

        <button type="button" id="btn-generate-gramota" class="quiz-next-btn">
          ✦ Выписать именную Грамоту
        </button>
      </div>
    `;

    const inputEl = document.getElementById('quiz-visitor-fullname');
    const confirmBtn = document.getElementById('btn-generate-gramota');

    setTimeout(() => inputEl?.focus(), 60);

    const submitName = () => {
      const entered = inputEl?.value.trim() || 'Почётный посетитель музея';
      this.visitorName = entered;
      localStorage.setItem('ldpk_diploma_name', entered);
      this.isNameConfirmed = true;
      globalSoundEngine?.playNobleClick();
      this.renderOfficialGramota(body, total);
    };

    confirmBtn?.addEventListener('click', submitName);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitName();
      }
    });
  }

  /**
   * Финал Викторины 2.0: Электронная именная «Грамота знатока истории ЛДПК» с возможностью правки Ф.И.О.
   */
  renderOfficialGramota(body, total) {
    const score = this.app.quizScore;
    const pct = Math.round((score / total) * 100);
    const displayName = this.visitorName || 'Почётный посетитель музея';

    let honorStatus = 'Слушатель исторического курса ЛДПК';
    if (score === total) {
      honorStatus = 'Почётный Хранитель истории ЛДПК I степени';
    } else if (score >= total - 1) {
      honorStatus = 'Знаток истории и наследия ЛДПК';
    }

    const dateStr = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    body.innerHTML = `
      <div class="gramota-parchment-card">
        <div class="gramota-inner-frame">
          <div class="gramota-top-crest">ГГТУ • ЛИКИНО-ДУЛЁВСКИЙ ПОЛИТЕХНИЧЕСКИЙ КОЛЛЕДЖ</div>
          <h3 class="gramota-main-title">ГРАМОТА</h3>
          <div class="gramota-subtitle">ЗНАТОКА ИСТОРИИ ЛДПК</div>

          <div class="gramota-recipient-block">
            <label for="gramota-name-input" class="gramota-label">Настоящая грамота вручается (можно кликнуть для изменения):</label>
            <input type="text" id="gramota-name-input" class="gramota-name-input"
                   value="${this.app.escapeHtml(displayName)}" placeholder="Введите Имя и Фамилию">
          </div>

          <p class="gramota-body-text">
            за глубокие знания летописи колледжа (1941–2026 гг.), индустриального наследия края
            и бережное отношение к исторической памяти.
          </p>

          <div class="gramota-rank-pill">${honorStatus}</div>

          <div class="gramota-footer-row">
            <div class="gramota-score-box">
              <span>ИТОГОВЫЙ БАЛЛ</span>
              <strong>${score} из ${total} (${pct}%)</strong>
              <small>${dateStr}</small>
            </div>

            <div class="museum-official-seal" title="Официальная печать экспозиции">
              <svg viewBox="0 0 120 120" class="seal-svg">
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 2"/>
                <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="60" cy="60" r="28" fill="none" stroke="currentColor" stroke-width="1"/>
                <text x="60" y="30" text-anchor="middle" font-size="8" font-weight="700" letter-spacing="1.5" fill="currentColor">МУЗЕЙ ИСТОРИИ</text>
                <text x="60" y="64" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="2" fill="currentColor">ЛДПК</text>
                <text x="60" y="76" text-anchor="middle" font-size="7" font-weight="600" fill="currentColor">1941–2026</text>
                <text x="60" y="96" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="1" fill="currentColor">ФОНД НАСЛЕДИЯ</text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="gramota-actions-bar" style="display:flex; gap:10px;">
        <button type="button" id="btn-edit-gramota-name" class="btn-map-tool" style="padding: 12px 16px; border-radius:10px;">
          ✎ Изменить имя
        </button>
        <button type="button" id="quiz-restart-btn" class="quiz-next-btn" style="flex:1;">
          Пройти снова
        </button>
      </div>
    `;

    const nameInp = document.getElementById('gramota-name-input');
    nameInp?.addEventListener('input', (e) => {
      this.visitorName = e.target.value.trim();
      localStorage.setItem('ldpk_diploma_name', this.visitorName);
    });

    document.getElementById('btn-edit-gramota-name')?.addEventListener('click', () => {
      this.isNameConfirmed = false;
      this.renderNamePromptScreen(body, total);
    });

    document.getElementById('quiz-restart-btn')?.addEventListener('click', () => {
      this.isNameConfirmed = false;
      this.app.quizCurrentIndex = 0;
      this.app.quizScore = 0;
      this.renderNobleQuizStep();
    });
  }
}

/* ==========================================================================
   ЕДИНАЯ ТОЧКА ПОДКЛЮЧЕНИЯ К MUSEUMAPP
   ========================================================================== */
export function initDigitalTwinAndScanner(appInstance) {
  const digitalTwinMap = new Museum3DMap(appInstance);
  const catalogV2 = new ChronoArchiveCatalogV2(appInstance);
  const quizV2 = new NobleQuizV2(appInstance);

  if (!appInstance) {
    return { digitalTwinMap, catalogV2, quizV2 };
  }

  const origOpenMap = appInstance.openMap.bind(appInstance);
  appInstance.openMap = function () {
    origOpenMap();
    digitalTwinMap.rebuildBrassPedestals();
    digitalTwinMap.highlightActiveHall(appInstance.currentHall?.id);
    digitalTwinMap.resetCameraView();
    digitalTwinMap.syncRenderMode();
  };

  const origCloseMap = appInstance.closeMap.bind(appInstance);
  appInstance.closeMap = function () {
    origCloseMap();
    digitalTwinMap.stopLoop();
  };

  const origFinishHall = appInstance.finishHallTransition.bind(appInstance);
  appInstance.finishHallTransition = function (hall, targetVitrineId = null) {
    origFinishHall(hall, targetVitrineId);
    digitalTwinMap.highlightActiveHall(hall.id);
  };

  return { digitalTwinMap, catalogV2, quizV2 };
}