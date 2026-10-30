(() => {
  const cfg = window.MUSEUM_CONFIG;
  if (!cfg) return;
  document.body.classList.add(`museum-room-${cfg.roomId || 1}`);

  // Minimal tour UI: remove old quest/map/search/collection/excursion elements if cached by browser.
  document.querySelectorAll("#btnMap,#btnSearch,#btnCollection,#btnHelp,#btnQuest,#btnGuide,#btnAudio,#modalMap,#modalSearch,#modalCollection,#modalHelp,#modalQuest,#modalGuide,#guideWidget,#timeline").forEach(el => el.remove());

  // ---------------- Storage keys ----------------
  const LS_ROOMS = "vmuseum_rooms_visited_v1";
  const LS_EXHIBITS = "vmuseum_exhibits_v1";
  const LS_HINT = "vmuseum_hint_hidden_v1";
  const LS_AUDIO = "vmuseum_audio_enabled_v1";
  const LS_QUEST = "vmuseum_quest_state_v1";
  const LS_GUIDE = "vmuseum_guide_state_v1";
  const LS_TIMELINE = "vmuseum_timeline_selected_v1";

  // ---------------- DOM refs ----------------
  const scene = document.getElementById("scene");
  const imageWrapper = document.getElementById("imageWrapper");
  const backgroundImage = document.getElementById("backgroundImage");
  const pointsContainer = document.getElementById("pointsContainer");

  // UI
  const titleEl = document.getElementById("museumHeaderTitle");
  const roomLabelEl = document.getElementById("roomLabel");
  const hintEl = document.getElementById("hint");

  const infoBox = document.getElementById("infoBox");
  const infoImage = document.getElementById("infoImage");
  const infoTitle = document.getElementById("infoTitle");
  const infoText = document.getElementById("infoText");
  const infoLink = document.getElementById("infoLink");
  const closeInfo = document.getElementById("closeInfo");

  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnMap = document.getElementById("btnMap");
  const btnSearch = document.getElementById("btnSearch");
  const btnCollection = document.getElementById("btnCollection");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnHelp = document.getElementById("btnHelp");

  const modalMap = document.getElementById("modalMap");
  const modalSearch = document.getElementById("modalSearch");
  const modalCollection = document.getElementById("modalCollection");
  const modalHelp = document.getElementById("modalHelp");

  const mapGrid = document.getElementById("mapGrid");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const collectionList = document.getElementById("collectionList");

  // ---------------- Helpers ----------------
  const safeParseJSON = (s, fallback) => {
    try { return JSON.parse(s); } catch { return fallback; }
  };

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));


  function openExhibitPage(pointData) {
    const info = pointData?.info;
    if (!info) return;
    const params = new URLSearchParams();
    params.set("title", info.title || pointData.tooltip || "Экспонат");
    params.set("image", info.image || info.link || "");
    params.set("description", info.description || "Описание экспоната пока не заполнено.");
    params.set("room", roomLabelEl?.textContent || titleEl?.textContent || `Комната ${cfg.roomId || ""}`);
    params.set("back", window.location.pathname + window.location.search);
    try {
      addExhibit({
        roomId: cfg.roomId,
        title: info.title || pointData.tooltip || "Экспонат",
        image: info.image || "",
        link: info.link || info.image || ""
      });
    } catch {}
    window.location.href = `/exhibit?${params.toString()}`;
  }

  const formatDateRu = (iso) => {
    try {
      const d = iso ? new Date(iso) : new Date();
      return d.toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  };

  // ---------------- Rooms & exhibits persistence ----------------
  const getVisitedRooms = () => {
    const arr = safeParseJSON(localStorage.getItem(LS_ROOMS) || "[]", []);
    return Array.isArray(arr) ? arr : [];
  };

  const setVisitedRooms = (arr) => {
    localStorage.setItem(LS_ROOMS, JSON.stringify(arr));
  };

  const markRoomVisited = (roomId) => {
    const visited = getVisitedRooms();
    if (!visited.includes(roomId)) {
      visited.push(roomId);
      setVisitedRooms(visited);
    }
  };

  const getExhibits = () => {
    const arr = safeParseJSON(localStorage.getItem(LS_EXHIBITS) || "[]", []);
    return Array.isArray(arr) ? arr : [];
  };

  const setExhibits = (arr) => {
    localStorage.setItem(LS_EXHIBITS, JSON.stringify(arr));
  };

  const addExhibit = (ex) => {
    const items = getExhibits();
    const key = (ex.link || ex.image || "").trim();
    if (!key) return;

    const exists = items.some(i => (i.link || i.image || "") === key);
    if (exists) return;

    items.unshift({
      roomId: ex.roomId,
      title: ex.title || "Экспонат",
      image: ex.image || "",
      link: ex.link || ex.image || "",
      seenAt: new Date().toISOString()
    });

    // ограничение (чтобы не раздувать localStorage)
    setExhibits(items.slice(0, 200));
  };

  // ---------------- Extra UI injection (Quest / Guide / Audio / Toast / Timeline) ----------------
  function ensureModal(id, title, ariaLabel, bodyHTML) {
    let modal = document.getElementById(id);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal";
    modal.id = id;
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__panel" role="dialog" aria-modal="true" aria-label="${ariaLabel || title}">
        <div class="modal__header">
          <div class="modal__title">${title}</div>
          <button class="mbtn mbtn--icon" type="button" data-close="modal">×</button>
        </div>
        <div class="modal__body">${bodyHTML || ""}</div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function ensureIconButton(id, emoji, label, insertBeforeId) {
    let btn = document.getElementById(id);
    if (btn) return btn;

    const groups = qsa(".museum-topbar .museum-topbar__group");
    const rightGroup = groups.length ? groups[groups.length - 1] : null;
    if (!rightGroup) return null;

    btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.className = "mbtn mbtn--icon";
    btn.textContent = emoji;
    btn.title = label;
    btn.setAttribute("aria-label", label);

    const before = insertBeforeId ? rightGroup.querySelector(`#${insertBeforeId}`) : null;
    if (before) rightGroup.insertBefore(btn, before);
    else rightGroup.appendChild(btn);

    return btn;
  }

  function ensureToast() {
    let toast = document.getElementById("toast");
    if (toast) return toast;
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    return toast;
  }

  const toastEl = ensureToast();
  let toastTimer = null;
  const showToast = (msg, ms = 2600) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-open"), ms);
  };

  // Extra buttons
  const btnQuest = null;
  const btnGuide = null;
  const btnAudio = null;

  // Extra modals
  const modalQuest = null;

  const modalGuide = null;

  // Floating guide widget
  function ensureGuideWidget() {
    let el = document.getElementById("guideWidget");
    if (el) return el;

    el = document.createElement("div");
    el.id = "guideWidget";
    el.className = "guide-widget";
    el.innerHTML = `
      <div class="guide-widget__left">
        <div class="guide-widget__title">Экскурсия</div>
        <div class="guide-widget__step" id="guideWidgetStep">1/1</div>
      </div>
      <div class="guide-widget__right">
        <button class="mbtn mbtn--icon" type="button" id="guideWidgetPrev" aria-label="Предыдущий">←</button>
        <button class="mbtn mbtn--icon" type="button" id="guideWidgetNext" aria-label="Следующий">→</button>
        <button class="mbtn mbtn--icon" type="button" id="guideWidgetStop" aria-label="Остановить">×</button>
      </div>
    `;

    document.body.appendChild(el);
    return el;
  }

  const guideWidget = null;
  const guideWidgetStep = document.getElementById("guideWidgetStep");
  const guideWidgetPrev = document.getElementById("guideWidgetPrev");
  const guideWidgetNext = document.getElementById("guideWidgetNext");
  const guideWidgetStop = document.getElementById("guideWidgetStop");

  // Timeline container (создаётся только если есть данные)
  function ensureTimelineShell() {
    return null;
  }

  // All modals (for global close)
  const allModals = [modalMap, modalSearch, modalCollection, modalHelp, modalQuest, modalGuide].filter(Boolean);

  const isAnyModalOpen = () => allModals.some(m => m.classList.contains("is-open"));

  const closeAllModals = () => {
    allModals.forEach(m => m.classList.remove("is-open"));
  };

  const openModal = (modal) => {
    closeAllModals();
    modal?.classList.add("is-open");
  };

  // Extend existing modal close logic to include dynamically created modals
  allModals.forEach(modal => {
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("is-open");
    });
    modal?.querySelectorAll("[data-close='modal']").forEach(btn => {
      btn.addEventListener("click", () => modal.classList.remove("is-open"));
    });
  });

  // ---------------- Hint ----------------
  const hideHint = () => {
    if (!hintEl) return;
    hintEl.classList.add("is-hidden");
    localStorage.setItem(LS_HINT, "1");
  };

  const showHintIfNeeded = () => {
    if (!hintEl) return;
    const hidden = localStorage.getItem(LS_HINT) === "1";
    if (hidden) hintEl.classList.add("is-hidden");
  };

  // ---------------- Header text ----------------
  if (titleEl) titleEl.textContent = cfg.headerTitle || "Виртуальный музей";
  if (roomLabelEl) roomLabelEl.textContent = `Комната ${cfg.roomId} / ${cfg.rooms?.length || 4}`;

  // ---------------- Visited rooms ----------------
  markRoomVisited(cfg.roomId);

  // ---------------- Quest ----------------
  // Набор заданий (по одному ключевому экспонату в разных местах)
  const QUEST_TASKS = [
    {
      id: "q_1935",
      roomId: 1,
      title: "Дулёвский художественно-керамический техникум (1935–1941)",
      link: "/static/assets/26_image_2025-05-28_19-18-33_a14369dd.png",
      hint: "История начинается с 1935 года."
    },
    {
      id: "q_1954",
      roomId: 1,
      title: "Вечерний лесотехнический техникум (1954–1956)",
      link: "/static/assets/10_image_2025-05-28_18-24-02_2b106d69.png",
      hint: "Ищите подпись с 1954–1956."
    },
    {
      id: "q_1966",
      roomId: 1,
      title: "ЛиДАМТ (1966–2007)",
      link: "/static/assets/27_image_2025-05-28_15-14-48_7d634818.png",
      hint: "В названии есть 1966–2007."
    },
    {
      id: "q_camera",
      roomId: 2,
      title: "Фотоаппарат",
      link: "/static/assets/36_3Bm7H3Sotgs_7739cf5e.jpg",
      hint: "Зал 2: Быт и культура Ликино-Дулёва."
    },
    {
      id: "q_memory",
      roomId: 3,
      title: "Книга Памяти",
      link: "/static/assets/11_430A77D5-C14F-4B21-A4B3-674A4CC154C8_7274777a.png",
      hint: "Комната 3: ищите подпись «Книга памяти»."
    }
  ];

  const getQuestState = () => {
    const s = safeParseJSON(localStorage.getItem(LS_QUEST) || "{}", {});
    const found = (s && typeof s === "object" && s.found && typeof s.found === "object") ? s.found : {};
    const completedAt = (s && typeof s === "object" && typeof s.completedAt === "string") ? s.completedAt : null;
    return { found, completedAt };
  };

  const setQuestState = (state) => {
    localStorage.setItem(LS_QUEST, JSON.stringify(state));
  };

  const questProgress = () => {
    const st = getQuestState();
    const done = QUEST_TASKS.filter(t => st.found[t.id]).length;
    return { done, total: QUEST_TASKS.length, completedAt: st.completedAt };
  };

  function updateQuestButtonBadge() {
    if (!btnQuest) return;
    const p = questProgress();
    if (p.done > 0 && p.done < p.total) {
      btnQuest.setAttribute("data-badge", `${p.done}/${p.total}`);
    } else if (p.done >= p.total) {
      btnQuest.setAttribute("data-badge", "✓");
    } else {
      btnQuest.removeAttribute("data-badge");
    }
  }

  function launchConfetti() {
    const canvas = document.createElement("canvas");
    canvas.className = "confetti";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    document.body.appendChild(canvas);

    const colors = ["#ffdd00", "#00d1ff", "#ff4d4d", "#7cff7c", "#b78cff"]; // небольшая палитра
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 3.5,
      vy: 2 + Math.random() * 5,
      r: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));

    const start = performance.now();
    const duration = 2200;

    function frame(t) {
      const dt = (t - start) / duration;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      });

      if (dt < 1) {
        requestAnimationFrame(frame);
      } else {
        window.removeEventListener("resize", resize);
        canvas.remove();
      }
    }

    requestAnimationFrame(frame);
  }

  function markQuestFoundByLink(link) {
    if (!link) return;
    const st = getQuestState();
    let changed = false;

    for (const task of QUEST_TASKS) {
      if (task.link === link && !st.found[task.id]) {
        st.found[task.id] = true;
        changed = true;
      }
    }

    // Если что-то новое нашли — сохранить и проверить завершение
    if (changed) {
      const p = questProgress();
      const doneNow = QUEST_TASKS.filter(t => st.found[t.id]).length;

      if (doneNow >= QUEST_TASKS.length && !st.completedAt) {
        st.completedAt = new Date().toISOString();
        showToast("🏆 Квест пройден! Откройте «Сертификат» в окне квеста.");
        launchConfetti();
      } else {
        showToast(`🏆 Квест: ${doneNow}/${QUEST_TASKS.length}`);
      }

      setQuestState(st);
      updateQuestButtonBadge();
      renderQuest();
    }
  }

  function resetQuest() {
    setQuestState({ found: {}, completedAt: null });
    updateQuestButtonBadge();
    renderQuest();
    showToast("Квест сброшен.");
  }

  function drawCertificateToCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0c2a4a");
    grad.addColorStop(1, "#0a1630");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // border
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";

    // title
    ctx.font = "bold 52px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText("СЕРТИФИКАТ", W / 2, 150);

    ctx.font = "28px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("о прохождении квеста виртуального музея", W / 2, 205);

    // museum title
    ctx.fillStyle = "#ffdd00";
    ctx.font = "bold 34px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText(cfg.headerTitle || "Интерактивный музей", W / 2, 270);

    // stats
    const st = getQuestState();
    const p = questProgress();
    const completedDate = st.completedAt ? formatDateRu(st.completedAt) : formatDateRu(new Date().toISOString());

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "26px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText(`Выполнено заданий: ${p.done}/${p.total}`, W / 2, 380);

    const roomsVisited = getVisitedRooms().length;
    const exhibitsSeen = getExhibits().length;
    ctx.font = "22px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`Посещено комнат: ${roomsVisited} • Просмотрено экспонатов: ${exhibitsSeen}`, W / 2, 420);

    // date
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "22px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText(`Дата: ${completedDate}`, W / 2, 520);

    // signature
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText("Сгенерировано автоматически в вашем браузере", W / 2, H - 90);

    // badge
    ctx.fillStyle = "rgba(255,221,0,0.22)";
    ctx.beginPath();
    ctx.arc(W / 2, 635, 80, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,221,0,0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2, 635, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffdd00";
    ctx.font = "bold 54px system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText("🏆", W / 2, 655);
  }

  function downloadCertificate() {
    const canvas = document.getElementById("questCertificateCanvas");
    if (!canvas) return;

    drawCertificateToCanvas(canvas);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "certificate_virtual_museum.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  }

  function renderQuest() {
    const root = document.getElementById("questRoot");
    if (!root) return;

    const st = getQuestState();
    const p = questProgress();

    const roomsById = new Map((cfg.rooms || []).map(r => [r.id, r]));

    root.innerHTML = `
      <div class="quest__header">
        <div>
          <div class="quest__name">Найдите 5 экспонатов</div>
          <div class="quest__sub">Открывайте карточки экспонатов — прогресс сохранится между комнатами.</div>
        </div>
        <div class="quest__count">${p.done}/${p.total}</div>
      </div>

      <div class="progressbar" aria-label="Прогресс квеста">
        <div class="progressbar__fill" style="width:${Math.round((p.done / p.total) * 100)}%"></div>
      </div>

      <div class="quest__list" role="list">
        ${QUEST_TASKS.map(t => {
          const done = !!st.found[t.id];
          const room = roomsById.get(t.roomId);
          const jumpUrl = (room?.url || "#") + `?open=${encodeURIComponent(t.link)}`;
          return `
            <div class="quest-item ${done ? "is-done" : ""}" role="listitem">
              <div class="quest-item__left">
                <div class="quest-item__check">${done ? "✓" : "•"}</div>
                <div class="quest-item__meta">
                  <div class="quest-item__title">${t.title}</div>
                  <div class="quest-item__hint">${done ? "Найдено" : (t.hint || "")}</div>
                </div>
              </div>
              <a class="mbtn" href="${jumpUrl}" style="text-decoration:none">Показать</a>
            </div>
          `;
        }).join("")}
      </div>

      <div class="quest__actions">
        <button class="mbtn" type="button" id="btnQuestReset">Сбросить квест</button>
        <button class="mbtn" type="button" id="btnQuestCert" ${p.done < p.total ? "disabled" : ""}>Сертификат</button>
        <button class="mbtn" type="button" id="btnQuestDownload" ${p.done < p.total ? "disabled" : ""}>Скачать PNG</button>
      </div>

      <div class="certificate ${p.done < p.total ? "is-hidden" : ""}" id="questCertificate">
        <canvas id="questCertificateCanvas" width="1200" height="800"></canvas>
        <div class="small-note" style="margin-top:10px;">Совет: сертификат можно сохранить и отправить преподавателю или группе.</div>
      </div>
    `;

    // bind buttons
    const bReset = document.getElementById("btnQuestReset");
    const bCert = document.getElementById("btnQuestCert");
    const bDl = document.getElementById("btnQuestDownload");

    bReset?.addEventListener("click", resetQuest);

    bCert?.addEventListener("click", () => {
      const block = document.getElementById("questCertificate");
      const canvas = document.getElementById("questCertificateCanvas");
      if (block) block.classList.toggle("is-hidden");
      if (canvas && !block?.classList.contains("is-hidden")) {
        drawCertificateToCanvas(canvas);
      }
    });

    bDl?.addEventListener("click", downloadCertificate);

    // draw on open if already completed
    const canvas = document.getElementById("questCertificateCanvas");
    const block = document.getElementById("questCertificate");
    if (canvas && block && !block.classList.contains("is-hidden")) {
      drawCertificateToCanvas(canvas);
    }
  }

  updateQuestButtonBadge();

  // ---------------- Guide (excursion) ----------------
  // Путь экскурсии (исторический порядок + несколько предметов из других комнат)
  const GUIDE_PATH = [
    {
      id: "g_1935",
      roomId: 1,
      title: "Дулёвский художественно-керамический техникум (1935–1941)",
      link: "/static/assets/26_image_2025-05-28_19-18-33_a14369dd.png"
    },
    {
      id: "g_1941",
      roomId: 1,
      title: "Дулёвский керамический техникум (1941–1962)",
      link: "/static/assets/23_image_2025-05-28_18-43-01_9099e67a.png"
    },
    {
      id: "g_1954",
      roomId: 1,
      title: "Вечерний лесотехнический техникум (1954–1956)",
      link: "/static/assets/10_image_2025-05-28_18-24-02_2b106d69.png"
    },
    {
      id: "g_1962",
      roomId: 1,
      title: "ЛиДИТ (1962–1966)",
      link: "/static/assets/07_image_2025-05-28_18-01-46_5c8b61ae.png"
    },
    {
      id: "g_1966",
      roomId: 1,
      title: "ЛиДАМТ (1966–2007)",
      link: "/static/assets/27_image_2025-05-28_15-14-48_7d634818.png"
    },
    {
      id: "g_camera",
      roomId: 2,
      title: "Фотоаппарат",
      link: "/static/assets/36_3Bm7H3Sotgs_7739cf5e.jpg"
    },
    {
      id: "g_memory",
      roomId: 3,
      title: "Книга Памяти",
      link: "/static/assets/11_430A77D5-C14F-4B21-A4B3-674A4CC154C8_7274777a.png"
    },
    {
      id: "g_icon",
      roomId: 4,
      title: "Икона «Достойно есть»",
      link: "/static/assets/04_28949933-FED4-48CC-9C6A-714C931934C7_39ebbcc7.png"
    }
  ];

  const roomsById = new Map((cfg.rooms || []).map(r => [r.id, r]));

  const getGuideState = () => {
    const s = safeParseJSON(localStorage.getItem(LS_GUIDE) || "{}", {});
    const active = !!(s && typeof s === "object" && s.active);
    let index = (s && typeof s === "object" && Number.isFinite(s.index)) ? s.index : 0;
    if (index < 0) index = 0;
    if (index >= GUIDE_PATH.length) index = GUIDE_PATH.length - 1;
    return { active, index };
  };

  const setGuideState = (state) => {
    localStorage.setItem(LS_GUIDE, JSON.stringify(state));
  };

  function updateGuideWidget() {
    const st = getGuideState();
    if (!guideWidget) return;

    if (!st.active) {
      guideWidget.classList.remove("is-open");
      return;
    }

    guideWidget.classList.add("is-open");
    if (guideWidgetStep) guideWidgetStep.textContent = `${st.index + 1}/${GUIDE_PATH.length}`;
  }

  function goToGuideIndex(index) {
    if (!Number.isFinite(index)) return;
    if (index < 0) index = 0;
    if (index >= GUIDE_PATH.length) index = GUIDE_PATH.length - 1;

    const item = GUIDE_PATH[index];
    if (!item) return;

    setGuideState({ active: true, index });
    updateGuideWidget();

    // если экспонат в другой комнате — переходим туда и автро-открываем
    if (item.roomId !== cfg.roomId) {
      const room = roomsById.get(item.roomId);
      if (room?.url) {
        window.location.href = room.url + `?open=${encodeURIComponent(item.link)}&guide=1`;
      }
      return;
    }

    // в этой комнате — просто показать
    const p = points.find(pt => (pt.info?.link || pt.info?.image || "") === item.link);
    if (!p) {
      showToast("Экспонат из экскурсии не найден в этой комнате.");
      return;
    }

    panToPoint(p.x);
    setTimeout(() => openExhibitPage(p), 220);
  }

  function stopGuide() {
    setGuideState({ active: false, index: 0 });
    updateGuideWidget();
    showToast("Экскурсия остановлена.");
  }

  function renderGuide() {
    const root = document.getElementById("guideRoot");
    if (!root) return;

    const st = getGuideState();
    const current = GUIDE_PATH[st.index] || GUIDE_PATH[0];

    root.innerHTML = `
      <div class="guide__header">
        <div>
          <div class="guide__name">Режим экскурсовода</div>
          <div class="guide__sub">Последовательно откроем ключевые экспонаты. Можно начать с любого шага.</div>
        </div>
        <div class="guide__count">${st.index + 1}/${GUIDE_PATH.length}</div>
      </div>

      <div class="guide__now">
        <div class="guide__nowlabel">Сейчас:</div>
        <div class="guide__nowtitle">${current?.title || ""}</div>
        <div class="guide__nowroom">Комната ${current?.roomId || "?"}</div>
      </div>

      <div class="guide__actions">
        <button class="mbtn" type="button" id="btnGuideStart">${st.active ? "Продолжить" : "Начать"}</button>
        <button class="mbtn" type="button" id="btnGuidePrev" ${st.index <= 0 ? "disabled" : ""}>← Предыдущий</button>
        <button class="mbtn" type="button" id="btnGuideNext" ${st.index >= GUIDE_PATH.length - 1 ? "disabled" : ""}>Следующий →</button>
        <button class="mbtn" type="button" id="btnGuideStop" ${st.active ? "" : "disabled"}>Остановить</button>
      </div>

      <div class="guide__list" role="list">
        ${GUIDE_PATH.map((it, idx) => {
          const isCurrent = idx === st.index;
          return `
            <button class="guide-step ${isCurrent ? "is-current" : ""}" type="button" data-guide-index="${idx}" role="listitem">
              <span class="guide-step__num">${idx + 1}.</span>
              <span class="guide-step__title">${it.title}</span>
              <span class="guide-step__room">Комната ${it.roomId}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;

    const bStart = document.getElementById("btnGuideStart");
    const bPrev = document.getElementById("btnGuidePrev");
    const bNext = document.getElementById("btnGuideNext");
    const bStop = document.getElementById("btnGuideStop");

    bStart?.addEventListener("click", () => {
      const s = getGuideState();
      goToGuideIndex(s.index || 0);
    });

    bPrev?.addEventListener("click", () => {
      const s = getGuideState();
      goToGuideIndex(s.index - 1);
    });

    bNext?.addEventListener("click", () => {
      const s = getGuideState();
      goToGuideIndex(s.index + 1);
    });

    bStop?.addEventListener("click", stopGuide);

    qsa("[data-guide-index]", root).forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-guide-index") || "0", 10);
        goToGuideIndex(idx);
        modalGuide?.classList.remove("is-open");
      });
    });
  }

  updateGuideWidget();

  // ---------------- Ambient audio ----------------
  let audioCtx = null;
  let audioNodes = null;

  function setAudioButtonState(on) {
    if (!btnAudio) return;
    btnAudio.textContent = on ? "🔇" : "🔈";
    btnAudio.title = on ? "Выключить звук" : "Включить звук";
    btnAudio.setAttribute("aria-label", btnAudio.title);
  }

  function isAudioEnabled() {
    return localStorage.getItem(LS_AUDIO) === "1";
  }

  function saveAudioEnabled(v) {
    localStorage.setItem(LS_AUDIO, v ? "1" : "0");
  }

  function startAmbient() {
    if (audioCtx && audioNodes) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Генерируем белый шум
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 420;

    const highpass = audioCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 90;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.02;

    // лёгкое “дыхание” громкости
    const lfo = audioCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.08;

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.007;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    noise.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
    lfo.start();

    audioNodes = { noise, lowpass, highpass, gain, lfo, lfoGain };
  }

  function stopAmbient() {
    try {
      if (audioNodes?.noise) audioNodes.noise.stop();
      if (audioNodes?.lfo) audioNodes.lfo.stop();
    } catch {
      // ignore
    }

    audioNodes = null;

    if (audioCtx) {
      try { audioCtx.close(); } catch {}
      audioCtx = null;
    }
  }

  function toggleAudio() {
    const on = isAudioEnabled();
    if (on) {
      saveAudioEnabled(false);
      stopAmbient();
      setAudioButtonState(false);
      showToast("Звук выключен.");
    } else {
      // start must be inside user gesture
      saveAudioEnabled(true);
      startAmbient();
      setAudioButtonState(true);
      showToast("Звук включён.");
    }
  }

  setAudioButtonState(isAudioEnabled());

  // ---------------- Panning ----------------
  let sceneWidth = scene.clientWidth;
  let imageWidth = 0;

  let minTranslate = 0;
  let maxTranslate = 0;

  let isDragging = false;
  let activePointerId = null;
  let startX = 0;

  let currentTranslateX = 0;
  let targetTranslateX = 0;

  function updateBounds() {
    sceneWidth = scene.clientWidth;
    imageWidth = backgroundImage.getBoundingClientRect().width;

    minTranslate = sceneWidth - imageWidth;
    maxTranslate = 0;

    // Если изображение меньше экрана — центрируем
    if (minTranslate > 0) {
      maxTranslate = (sceneWidth - imageWidth) / 2;
      minTranslate = maxTranslate;
    }

    clampTranslate();
    applyTransform(true);
  }

  function clampTranslate() {
    if (targetTranslateX > maxTranslate) targetTranslateX = maxTranslate;
    if (targetTranslateX < minTranslate) targetTranslateX = minTranslate;
  }

  function applyTransform(force = false) {
    if (force) currentTranslateX = targetTranslateX;
    imageWrapper.style.transform = `translateX(${currentTranslateX}px)`;

    // Данные для индикатора взгляда на плане
    window.__museumPanoramaState = {
      currentTranslateX,
      targetTranslateX,
      minTranslate,
      maxTranslate,
      sceneWidth,
      imageWidth
    };
  }

  function animate() {
    currentTranslateX += (targetTranslateX - currentTranslateX) * 0.12;
    applyTransform(false);
    requestAnimationFrame(animate);
  }

  // drag only if not clicking UI
  scene.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".point")) return;
    if (e.target.closest(".museum-topbar")) return;
    if (e.target.closest(".info-box")) return;
    if (e.target.closest(".modal")) return;
    if (e.target.closest(".timeline")) return;
    isDragging = true;
    activePointerId = e.pointerId;
    startX = e.clientX;

    scene.classList.add("is-grabbing");
    scene.setPointerCapture(activePointerId);

    hideHint();
    e.preventDefault();
  });

  scene.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    if (e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    startX = e.clientX;

    targetTranslateX += dx;
    clampTranslate();

    e.preventDefault();
  });

  function stopDrag(e) {
    if (!isDragging) return;
    if (activePointerId !== null && e && e.pointerId !== activePointerId) return;

    isDragging = false;
    activePointerId = null;
    scene.classList.remove("is-grabbing");
  }

  scene.addEventListener("pointerup", stopDrag);
  scene.addEventListener("pointercancel", stopDrag);

  // Keyboard pan
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      targetTranslateX += 60;
      clampTranslate();
    } else if (e.key === "ArrowRight") {
      targetTranslateX -= 60;
      clampTranslate();
    }
  });

  // ---------------- Points ----------------
  const points = Array.isArray(cfg.points) ? cfg.points : [];
  const pointEls = [];

  function extractYearRange(text) {
    const s = (text || "").toString();
    if (!s) return null;

    // range first
    const range = s.match(/(19\d{2}|20\d{2})\s*[–-]\s*(19\d{2}|20\d{2})/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return { min: Math.min(a, b), max: Math.max(a, b) };
      }
    }

    const years = Array.from(s.matchAll(/(19\d{2}|20\d{2})/g)).map(m => parseInt(m[1], 10)).filter(Number.isFinite);
    if (years.length === 0) return null;

    return { min: Math.min(...years), max: Math.max(...years) };
  }

  function yearRangeForPoint(p) {
    const info = p?.info;
    const t = `${info?.title || ""} ${info?.description || ""} ${p?.tooltip || ""}`;
    return extractYearRange(t);
  }

  function createPoint(data) {
    const point = document.createElement("button");
    point.type = "button";
    point.className = "point " + (data.info ? "point--info" : "point--nav");
    point.dataset.pointId = data.id || "";
    point.style.left = `${data.x}%`;
    point.style.top = `${data.y}%`;

    point.setAttribute("aria-label", data.tooltip || (data.info?.title ?? "Точка"));

    const img = document.createElement("img");
    img.src = data.icon || (data.info ? "/static/assets/14_point_e211e38e.png" : "/static/assets/13_image_2025-05-27_20-47-09_55ac7d96.png");
    img.alt = "";

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = data.tooltip || "";

    point.appendChild(img);
    point.appendChild(tooltip);

    // Year data for timeline
    if (data.info) {
      const link = (data.info.link || data.info.image || "").toString();
      if (link) point.dataset.link = link;

      const yr = yearRangeForPoint(data);
      if (yr) {
        point.dataset.yearMin = String(yr.min);
        point.dataset.yearMax = String(yr.max);
      }
    }

    // чтобы не тянулось, когда кликаем по точке
    ["pointerdown", "pointermove", "pointerup"].forEach(evt => {
      point.addEventListener(evt, (ev) => ev.stopPropagation());
    });

    point.addEventListener("click", () => {
      if (data.info) {
        openExhibitPage(data);
      } else if (data.href) {
        window.location.href = data.href;
      }
    });

    pointsContainer.appendChild(point);
    pointEls.push(point);
  }

  points.forEach(createPoint);

  // ---------------- Info box ----------------
  function openInfo(pointData) {
    const info = pointData.info;
    if (!info) return;

    infoImage.src = info.image || "";
    infoImage.alt = info.title || "";

    infoTitle.textContent = info.title || pointData.tooltip || "Экспонат";
    infoText.textContent = info.description || "";

    const link = info.link || info.image || "#";
    infoLink.href = link;
    infoLink.style.display = link && link !== "#" ? "inline-flex" : "none";

    infoBox.classList.add("is-open");
    infoBox.setAttribute("aria-hidden", "false");

    // сохраняем в “коллекцию”
    addExhibit({
      roomId: cfg.roomId,
      title: infoTitle.textContent,
      image: info.image || "",
      link
    });

    // квест
    markQuestFoundByLink(link);

    // экскурсия: если открыли текущий шаг — синхронизируем
    const st = getGuideState();
    if (st.active) {
      const idx = GUIDE_PATH.findIndex(it => it.link === link);
      if (idx >= 0 && idx !== st.index) {
        setGuideState({ active: true, index: idx });
        updateGuideWidget();
      }
    }
  }

  function closeInfoBox() {
    infoBox.classList.remove("is-open");
    infoBox.setAttribute("aria-hidden", "true");
  }

  closeInfo?.addEventListener("click", closeInfoBox);

  // Закрыть по клику вне окна
  document.addEventListener("click", (e) => {
    if (!infoBox.classList.contains("is-open")) return;
    if (e.target.closest("#infoBox")) return;
    if (e.target.closest(".point")) return;
    if (e.target.closest(".museum-topbar")) return;
    if (e.target.closest(".modal")) return;
    if (e.target.closest(".timeline")) return;
    closeInfoBox();
  });

  // ---------------- Map modal ----------------
  function renderMap() {
    if (!mapGrid) return;

    const visited = new Set(getVisitedRooms());
    const rooms = Array.isArray(cfg.rooms) ? cfg.rooms : [];

    mapGrid.innerHTML = "";
    rooms.forEach(room => {
      const card = document.createElement("div");
      card.className = "map-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", room.title);

      const bg = document.createElement("div");
      bg.className = "map-card__bg";
      bg.style.backgroundImage = `url('${room.bg}')`;

      const overlay = document.createElement("div");
      overlay.className = "map-card__overlay";

      const label = document.createElement("div");
      label.className = "map-card__label";
      label.innerHTML = `<span>${room.title}</span>`;

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = visited.has(room.id) ? "✓ Посещено" : "• Не посещено";
      label.appendChild(badge);

      card.appendChild(bg);
      card.appendChild(overlay);
      card.appendChild(label);

      card.addEventListener("click", () => {
        window.location.href = room.url;
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = room.url;
        }
      });

      mapGrid.appendChild(card);
    });
  }

  // ---------------- Collection modal ----------------
  function renderCollection() {
    if (!collectionList) return;
    const items = getExhibits();

    collectionList.innerHTML = "";

    if (items.length === 0) {
      const p = document.createElement("p");
      p.className = "small-note";
      p.textContent = "Пока пусто. Откройте любой экспонат — он появится здесь.";
      collectionList.appendChild(p);
      return;
    }

    const roomsByIdLocal = new Map((cfg.rooms || []).map(r => [r.id, r]));
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "list-item";

      const img = document.createElement("img");
      img.src = item.image || "";
      img.alt = "";

      const meta = document.createElement("div");
      meta.className = "list-item__meta";

      const title = document.createElement("div");
      title.className = "list-item__title";
      title.textContent = item.title || "Экспонат";

      const room = roomsByIdLocal.get(item.roomId);
      const sub = document.createElement("div");
      sub.className = "list-item__sub";
      sub.textContent = room ? `${room.title}` : `Комната ${item.roomId}`;

      meta.appendChild(title);
      meta.appendChild(sub);

      const openBtn = document.createElement("a");
      openBtn.className = "mbtn";
      openBtn.textContent = "Открыть";
      const params = new URLSearchParams();
      params.set("title", item.title || "Экспонат");
      params.set("image", item.image || item.link || "");
      params.set("description", "Экспонат из вашей коллекции. Для полного описания откройте его через точку в виртуальном туре.");
      params.set("room", room ? room.title : `Комната ${item.roomId}`);
      params.set("back", window.location.pathname + window.location.search);
      openBtn.href = `/exhibit?${params.toString()}`;
      openBtn.style.textDecoration = "none";

      row.appendChild(img);
      row.appendChild(meta);
      row.appendChild(openBtn);

      collectionList.appendChild(row);
    });
  }

  // ---------------- Search modal ----------------
  function renderSearchResults(query) {
    if (!searchResults) return;

    const q = (query || "").trim().toLowerCase();
    const infoPoints = points
      .filter(p => p.info)
      .map(p => ({
        x: p.x,
        y: p.y,
        title: (p.info?.title || p.tooltip || "Экспонат").toString(),
        link: (p.info?.link || p.info?.image || "").toString(),
        raw: p
      }));

    const filtered = q
      ? infoPoints.filter(p => p.title.toLowerCase().includes(q))
      : infoPoints.slice(0, 25);

    searchResults.innerHTML = "";

    if (filtered.length === 0) {
      const p = document.createElement("p");
      p.className = "small-note";
      p.textContent = "Ничего не найдено. Попробуйте другое название.";
      searchResults.appendChild(p);
      return;
    }

    filtered.slice(0, 50).forEach(item => {
      const row = document.createElement("div");
      row.className = "list-item";

      const img = document.createElement("img");
      img.src = item.raw.info?.image || "";
      img.alt = "";

      const meta = document.createElement("div");
      meta.className = "list-item__meta";

      const title = document.createElement("div");
      title.className = "list-item__title";
      title.textContent = item.title;

      const sub = document.createElement("div");
      sub.className = "list-item__sub";
      sub.textContent = "Нажмите, чтобы перейти к экспонату";

      meta.appendChild(title);
      meta.appendChild(sub);

      const goBtn = document.createElement("button");
      goBtn.className = "mbtn";
      goBtn.type = "button";
      goBtn.textContent = "Показать";

      goBtn.addEventListener("click", () => {
        modalSearch.classList.remove("is-open");
        openExhibitPage(item.raw);
      });

      row.appendChild(img);
      row.appendChild(meta);
      row.appendChild(goBtn);

      searchResults.appendChild(row);
    });
  }

  function panToPoint(xPercent) {
    const x = (xPercent / 100) * imageWidth;
    targetTranslateX = (sceneWidth / 2) - x;
    clampTranslate();
    hideHint();
  }

  // ---------------- Timeline ----------------
  const DEFAULT_TIMELINE = [1935, 1941, 1954, 1956, 1962, 1966, 1970, 1983, 1990, 2007, 2015];

  function pointMatchesYear(pointEl, year) {
    const min = parseInt(pointEl.dataset.yearMin || "", 10);
    const max = parseInt(pointEl.dataset.yearMax || "", 10);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
    return year >= min && year <= max;
  }

  function applyTimelineFilter(year) {
    // year === null -> reset
    let matches = 0;

    pointEls.forEach(el => {
      if (!el.classList.contains("point--info")) return;

      if (year === null) {
        el.classList.remove("is-dim", "is-highlight");
        return;
      }

      const ok = pointMatchesYear(el, year);
      if (ok) {
        matches += 1;
        el.classList.remove("is-dim");
        el.classList.add("is-highlight");
      } else {
        el.classList.add("is-dim");
        el.classList.remove("is-highlight");
      }
    });

    if (year === null) {
      localStorage.removeItem(LS_TIMELINE);
      showToast("Таймлайн: показаны все экспонаты.");
    } else {
      localStorage.setItem(LS_TIMELINE, String(year));
      showToast(`Таймлайн ${year}: найдено экспонатов — ${matches}`);
    }
  }

  function renderTimelineIfUseful() {
    // только если в комнате есть хоть какие-то диапазоны
    const infoEls = pointEls.filter(el => el.classList.contains("point--info") && el.dataset.yearMin);
    if (infoEls.length < 3) return; // слишком мало — не показываем

    const years = DEFAULT_TIMELINE.filter(y => infoEls.some(el => pointMatchesYear(el, y)));
    if (years.length < 2) return;

    const tl = ensureTimelineShell();
    const chips = document.getElementById("timelineChips");
    if (!tl || !chips) return;

    document.body.classList.add("has-timeline");

    chips.innerHTML = "";

    const addChip = (label, value) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = label;
      b.dataset.value = value === null ? "all" : String(value);
      b.addEventListener("click", () => {
        const cur = localStorage.getItem(LS_TIMELINE);
        if (value === null) {
          applyTimelineFilter(null);
          qsa(".chip", chips).forEach(c => c.classList.remove("is-active"));
          b.classList.add("is-active");
          return;
        }

        // toggle
        if (cur === String(value)) {
          applyTimelineFilter(null);
          qsa(".chip", chips).forEach(c => c.classList.remove("is-active"));
          const allChip = chips.querySelector(".chip[data-value='all']");
          allChip?.classList.add("is-active");
          return;
        }

        applyTimelineFilter(value);
        qsa(".chip", chips).forEach(c => c.classList.remove("is-active"));
        b.classList.add("is-active");
      });
      chips.appendChild(b);
      return b;
    };

    const allChip = addChip("Все", null);
    years.forEach(y => addChip(String(y), y));

    // restore
    const saved = localStorage.getItem(LS_TIMELINE);
    if (saved && years.includes(parseInt(saved, 10))) {
      const active = chips.querySelector(`.chip[data-value='${saved}']`);
      active?.classList.add("is-active");
      applyTimelineFilter(parseInt(saved, 10));
    } else {
      allChip?.classList.add("is-active");
    }
  }

  // ---------------- Help modal augmentation ----------------
  function augmentHelpModal() {
    if (!modalHelp) return;
    const ul = modalHelp.querySelector("ul");
    if (!ul) return;

    const already = ul.textContent.includes("квест") || ul.textContent.includes("Квест");
    if (already) return;

    const extra = document.createElement("li");
    extra.innerHTML = "Дополнительно: <b>🏆</b> — квест, <b>🧑‍🏫</b> — экскурсия, <b>🔈</b> — фоновый звук, таймлайн снизу (если доступен).";
    ul.appendChild(extra);

    const extra2 = document.createElement("li");
    extra2.innerHTML = "Горячие клавиши: <b>Q</b> — квест, <b>G</b> — экскурсия, <b>S</b> — звук.";
    ul.appendChild(extra2);
  }

  augmentHelpModal();

  // ---------------- UI Buttons ----------------
  btnPrev?.addEventListener("click", () => { if (cfg.prevUrl) window.location.href = cfg.prevUrl; });
  btnNext?.addEventListener("click", () => { if (cfg.nextUrl) window.location.href = cfg.nextUrl; });

  btnMap?.addEventListener("click", () => { renderMap(); openModal(modalMap); });
  btnCollection?.addEventListener("click", () => { renderCollection(); openModal(modalCollection); });

  btnSearch?.addEventListener("click", () => {
    openModal(modalSearch);
    renderSearchResults(searchInput?.value || "");
    setTimeout(() => searchInput?.focus(), 50);
  });

  btnHelp?.addEventListener("click", () => openModal(modalHelp));

  btnFullscreen?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  });

  btnQuest?.addEventListener("click", () => {
    renderQuest();
    openModal(modalQuest);
  });

  btnGuide?.addEventListener("click", () => {
    renderGuide();
    openModal(modalGuide);
  });

  btnAudio?.addEventListener("click", () => toggleAudio());

  // Guide widget controls
  guideWidgetPrev?.addEventListener("click", () => {
    const st = getGuideState();
    if (!st.active) return;
    goToGuideIndex(st.index - 1);
  });

  guideWidgetNext?.addEventListener("click", () => {
    const st = getGuideState();
    if (!st.active) return;
    goToGuideIndex(st.index + 1);
  });

  guideWidgetStop?.addEventListener("click", stopGuide);

  guideWidget?.addEventListener("dblclick", () => {
    renderGuide();
    openModal(modalGuide);
  });

  // Search input events
  searchInput?.addEventListener("input", () => renderSearchResults(searchInput.value));
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      renderSearchResults(searchInput.value);
    }
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (infoBox.classList.contains("is-open")) closeInfoBox();
      if (isAnyModalOpen()) closeAllModals();
    }

    // не мешаем набору текста
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.key === "f" || e.key === "F") {
      btnFullscreen?.click();
    } else if (e.key === "m" || e.key === "M") {
      btnMap?.click();
    } else if (e.key === "/") {
      e.preventDefault();
      btnSearch?.click();
    } else if (e.key === "c" || e.key === "C") {
      btnCollection?.click();
    } else if (e.key === "h" || e.key === "H") {
      btnHelp?.click();
    } else if (e.key === "q" || e.key === "Q") {
      btnQuest?.click();
    } else if (e.key === "g" || e.key === "G") {
      btnGuide?.click();
    } else if (e.key === "s" || e.key === "S") {
      btnAudio?.click();
    }
  });

  // ---------------- Auto-open from query (?open=...) ----------------
  function tryAutoOpenFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const open = params.get("open");
    if (!open) return;

    const needle = open;// URLSearchParams уже декодирует значение
    const p = points.find(pt => (pt.info?.link || pt.info?.image || "") === needle);
    if (!p) return;

    panToPoint(p.x);
    setTimeout(() => openExhibitPage(p), 220);

    // очищаем query без перезагрузки
    try {
      params.delete("open");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState({}, "", newUrl);
    } catch {
      // ignore
    }
  }

  // ---------------- Init ----------------
  showHintIfNeeded();

  const onReady = () => {
    updateBounds();
    renderTimelineIfUseful();

    // если звук сохранён как включённый — НЕ запускаем автоматически,
    // так как браузеры блокируют autoplay; но кнопка будет в "🔇".

    tryAutoOpenFromQuery();

    // Если экскурсия активна и пришли по guide=1 — покажем виджет
    const params = new URLSearchParams(window.location.search);
    const fromGuide = params.get("guide") === "1";
    if (fromGuide) {
      const st = getGuideState();
      if (st.active) {
        updateGuideWidget();
        // подскажем пользователю
        showToast("🧑‍🏫 Экскурсия активна — используйте стрелки на виджете.");
      }
    }
  };

  if (backgroundImage.complete) {
    setTimeout(onReady, 0);
  } else {
    backgroundImage.addEventListener("load", onReady, { once: true });
  }

  window.addEventListener("resize", () => updateBounds());

  animate();
})();


// Отключает всплывающую панель браузера/поиска на изображениях.
(function disableImageToolbars(){
  function protectImage(img){
    if (!img) return;
    img.setAttribute('draggable', 'false');
    img.setAttribute('data-no-image-toolbar', 'true');
    img.setAttribute('data-disable-image-toolbar', 'true');
    img.setAttribute('galleryimg', 'no');
    img.addEventListener('dragstart', function(e){ e.preventDefault(); }, { passive: false });
  }

  function protectAll(){
    document.querySelectorAll('img').forEach(protectImage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', protectAll);
  } else {
    protectAll();
  }

  const observer = new MutationObserver(protectAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();


// Галерейные боковые панели: план, виды залов, экспонаты комнаты
(function museumGallerySidePanels(){
  const cfg = window.MUSEUM_CONFIG;
  if (!cfg) return;

  const leftPanel = document.getElementById("museumLeftPanel");
  const rightPanel = document.getElementById("museumRightPanel");
  const openLeft = document.getElementById("openMuseumLeftPanel");
  const openRight = document.getElementById("openMuseumRightPanel");
  const planMap = document.getElementById("museumPlanMap");
  const viewsList = document.getElementById("museumViewsList");
  const exhibitsList = document.getElementById("museumRoomExhibits");
  const exhibitRoom = document.getElementById("museumExhibitRoom");

  function syncPanelState(){
    document.body.classList.toggle("museum-left-panel-open", !!leftPanel?.classList.contains("is-open"));
    document.body.classList.toggle("museum-right-panel-open", !!rightPanel?.classList.contains("is-open"));
  }

  function openPanel(panel){
    if (!panel) return;
    leftPanel?.classList.remove("is-open");
    rightPanel?.classList.remove("is-open");
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    syncPanelState();
  }

  function closePanels(){
    [leftPanel, rightPanel].forEach(panel => {
      panel?.classList.remove("is-open");
      panel?.setAttribute("aria-hidden", "true");
    });
    syncPanelState();
  }

  openLeft?.addEventListener("click", () => {
    if (leftPanel?.classList.contains("is-open")) closePanels();
    else openPanel(leftPanel);
  });
  openRight?.addEventListener("click", () => {
    if (rightPanel?.classList.contains("is-open")) closePanels();
    else openPanel(rightPanel);
  });

  [leftPanel, rightPanel].forEach(panel => {
    panel?.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    }, { capture: true });
    panel?.addEventListener("pointermove", (e) => {
      e.stopPropagation();
    }, { capture: true });
    panel?.addEventListener("wheel", (e) => {
      e.stopPropagation();
    }, { capture: true, passive: true });
  });
document.querySelectorAll("[data-panel-close]").forEach(el => {
    el.addEventListener("click", closePanels);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanels();
  });

  document.querySelectorAll("[data-tour-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tourTab;
      document.querySelectorAll("[data-tour-tab]").forEach(item => item.classList.toggle("is-active", item === tab));
      document.querySelectorAll("[data-tour-page]").forEach(page => {
        page.classList.toggle("is-active", page.dataset.tourPage === name);
      });
    });
  });

  function roomUrl(id){
    return `/komnata${id}`;
  }

  function roomName(id){
    const names = {
      1: "Зал 1: История ЛДПК: становление и развитие",
      2: "Зал 2: Быт и культура Ликино-Дулёва",
      3: "Военная память",
      4: "Достижения колледжа"
    };
    return names[id] || `Зал ${id}`;
  }

  function renderPlan(){
    if (!planMap) return;
    const current = Number(cfg.roomId || 1);
    const viewer = document.getElementById("museumPlanViewer");

    const positions = {
      1: ["50%", "16%"],
      2: ["73%", "47%"],
      3: ["73%", "79%"],
      4: ["24%", "53%"]
    };

    const pos = positions[current] || ["50%", "50%"];
    if (viewer) {
      viewer.style.left = pos[0];
      viewer.style.top = pos[1];
    }

    if (!planMap.querySelector(".museum-plan-hotspots")) {
      const hotspots = document.createElement("div");
      hotspots.className = "museum-plan-hotspots";
      [1, 2, 3, 4].forEach(id => {
        const a = document.createElement("a");
        a.href = roomUrl(id);
        a.className = `museum-plan-hotspot museum-plan-hotspot--${id}`;
        a.title = roomName(id);
        hotspots.appendChild(a);
      });
      planMap.appendChild(hotspots);
    }
  }

  function renderViews(){
    if (!viewsList) return;
    const rooms = Array.isArray(cfg.rooms) && cfg.rooms.length
      ? cfg.rooms
      : [
          { id: 1, title: "Зал 1: История ЛДПК: становление и развитие", image: document.getElementById("backgroundImage")?.src || "" },
          { id: 2, title: "Зал 2: Быт и культура Ликино-Дулёва", image: "" },
          { id: 3, title: "Зал 3", image: "" },
          { id: 4, title: "Зал 4", image: "" },
        ];

    viewsList.innerHTML = rooms.map((room, index) => {
      const id = room.id || index + 1;
      const title = room.title || roomName(id);
      const image = room.bg || room.image || "";
      const href = room.url || roomUrl(id);
      return `
        <a class="museum-view-card" href="${href}">
          ${image ? `<img src="${image}" alt="${title}" draggable="false" galleryimg="no">` : ""}
          <span>${title}</span>
        </a>
      `;
    }).join("");
  }

  function trimText(text, limit){
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length <= limit) return value;
    return value.slice(0, limit - 1) + "…";
  }

  function openExhibitUrl(point){
    const info = point.info || {};
    const params = new URLSearchParams();
    params.set("title", info.title || point.tooltip || "Экспонат");
    params.set("image", info.image || info.link || "");
    params.set("description", info.description || "Описание экспоната пока не заполнено.");
    params.set("room", `Комната ${cfg.roomId || ""}`);
    params.set("back", window.location.pathname + window.location.search);
    return `/exhibit?${params.toString()}`;
  }

  function renderExhibits(){
    if (!exhibitsList) return;
    if (exhibitRoom) exhibitRoom.textContent = `Экспонаты комнаты ${cfg.roomId || ""}`;
    const items = (cfg.points || []).filter(point => point && point.info && (point.info.image || point.info.link));
    if (!items.length) {
      exhibitsList.innerHTML = `<div class="museum-empty-list">В этой комнате экспонаты пока не добавлены.</div>`;
      return;
    }
    exhibitsList.innerHTML = items.map(point => {
      const info = point.info || {};
      const image = info.image || info.link || "";
      const title = info.title || point.tooltip || "Экспонат";
      const year = (String(info.description || "").match(/\b(19|20)\d{2}\b/) || [])[0] || "";
      return `
        <a class="museum-exhibit-card" href="${openExhibitUrl(point)}">
          <img src="${image}" alt="${title}" draggable="false" galleryimg="no">
          <strong>${trimText(title, 58)}</strong>
          <small>${year ? year : "из экспозиции"}</small>
        </a>
      `;
    }).join("");
  }

  function updatePlanViewerRotation(){
    const viewer = document.getElementById("museumPlanViewer");
    const state = window.__museumPanoramaState;
    if (viewer && state) {
      const range = Math.max(1, state.maxTranslate - state.minTranslate);
      const progress = (state.currentTranslateX - state.minTranslate) / range;
      let angle = -145 + progress * 290;

      // Для 1 комнаты: по центру индикатор смотрит вверх,
      // при повороте камеры вправо индикатор уходит влево-вверх.
      if (Number(cfg.roomId || 1) === 1) {
        angle = 145 - progress * 290;
      }

      viewer.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    }
    requestAnimationFrame(updatePlanViewerRotation);
  }

  renderPlan();
  renderViews();
  renderExhibits();
  updatePlanViewerRotation();
})();


// ---------------- Admin editor: точки и экспонаты сохраняются в data/exhibits.json ----------------
(function museumAdminEditor(){
  const cfg = window.MUSEUM_CONFIG;
  if (!cfg || !cfg.isAdmin) return;

  const scene = document.getElementById("scene");
  const imageWrapper = document.getElementById("imageWrapper");
  const pointsContainer = document.getElementById("pointsContainer");
  if (!scene || !imageWrapper || !pointsContainer) return;

  let editMode = false;
  let addMode = false;
  let dragging = null;
  let selectedPoint = null;

  function points(){
    return Array.isArray(cfg.points) ? cfg.points : [];
  }

  function findPoint(id){
    return points().find(point => String(point.id) === String(id));
  }

  function pointType(point){
    return point && point.info ? "info" : "nav";
  }

  function showNotice(text, isError = false){
    let el = document.getElementById("adminNotice");
    if (!el) {
      el = document.createElement("div");
      el.id = "adminNotice";
      el.className = "admin-notice";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle("is-error", isError);
    el.classList.add("is-open");
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => el.classList.remove("is-open"), 2600);
  }

  function getPointPositionFromEvent(e){
    const rect = imageWrapper.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(100, Number(y.toFixed(2))))
    };
  }

  async function createPointAt(e){
    const pos = getPointPositionFromEvent(e);
    const response = await fetch("/api/admin/points", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        roomId: cfg.roomId,
        x: pos.x,
        y: pos.y,
        title: "Новый экспонат",
        tooltip: "Новый экспонат",
        description: ""
      })
    });
    const data = await response.json();
    if (!data.ok) {
      showNotice(data.error || "Не удалось создать точку", true);
      return;
    }
    showNotice("Точка создана");
    window.location.reload();
  }

  async function savePoint(point, formData){
    const response = await fetch(`/api/admin/points/${cfg.roomId}/${encodeURIComponent(point.id)}`, {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!data.ok) {
      showNotice(data.error || "Не удалось сохранить", true);
      return null;
    }
    Object.assign(point, data.point);
    return data.point;
  }

  async function deletePoint(point){
    if (!confirm("Удалить эту точку?")) return;
    const response = await fetch(`/api/admin/points/${cfg.roomId}/${encodeURIComponent(point.id)}`, {
      method: "DELETE"
    });
    const data = await response.json();
    if (!data.ok) {
      showNotice(data.error || "Не удалось удалить", true);
      return;
    }
    showNotice("Точка удалена");
    window.location.reload();
  }

  function openEditor(point){
    selectedPoint = point;
    if (!point) return;

    const modal = document.getElementById("adminPointModal");
    const form = document.getElementById("adminPointForm");
    if (!modal || !form) return;

    const type = pointType(point);
    form.elements.point_type.value = type;
    form.elements.x.value = point.x ?? 50;
    form.elements.y.value = point.y ?? 50;
    form.elements.tooltip.value = point.tooltip || "";
    form.elements.href.value = point.href || "";
    form.elements.title.value = point.info?.title || point.tooltip || "";
    form.elements.description.value = point.info?.description || "";
    form.elements.image.value = point.info?.image || "";
    form.elements.link.value = point.info?.link || point.info?.image || "";
    if (form.elements.is_masterpiece) {
      form.elements.is_masterpiece.checked = Boolean(point.info?.is_masterpiece || point.info?.masterpiece || point.info?.featured);
    }
    form.elements.image_file.value = "";

    document.body.classList.toggle("admin-form-nav", type === "nav");
    modal.classList.add("is-open");
  }

  function closeEditor(){
    document.getElementById("adminPointModal")?.classList.remove("is-open");
    selectedPoint = null;
  }


  // ---------------- Admin analytics ----------------
  const analyticsPeriods = {
    hours: "Часы",
    days: "Дни",
    weeks: "Недели",
    months: "Месяцы",
    years: "Годы"
  };
  let analyticsPeriod = "days";

  function formatCount(value){
    return String(Number(value || 0));
  }

  function maxOfArrays(...arrays){
    const values = arrays.flat().map(v => Number(v || 0));
    return Math.max(1, ...values);
  }

  function buildSvgChart(chart){
    const labels = Array.isArray(chart?.labels) ? chart.labels : [];
    const views = Array.isArray(chart?.views) ? chart.views.map(v => Number(v || 0)) : [];
    const visitors = Array.isArray(chart?.visitors) ? chart.visitors.map(v => Number(v || 0)) : [];
    const count = Math.max(labels.length, views.length, visitors.length, 1);
    const max = maxOfArrays(views, visitors);
    const width = 920;
    const height = 300;
    const padX = 46;
    const padTop = 24;
    const padBottom = 58;
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;
    const step = count > 1 ? innerW / (count - 1) : innerW;

    const point = (value, index) => {
      const x = padX + (count === 1 ? innerW / 2 : index * step);
      const y = padTop + innerH - (Number(value || 0) / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const viewsLine = views.map(point).join(" ");
    const visitorsLine = visitors.map(point).join(" ");
    const barW = Math.max(8, Math.min(32, step * 0.42));

    const grid = [0, .25, .5, .75, 1].map(k => {
      const y = padTop + innerH - innerH * k;
      const label = Math.round(max * k);
      return `<line class="admin-analytics-chart__grid" x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}"></line><text class="admin-analytics-chart__axis" x="14" y="${y + 4}">${label}</text>`;
    }).join("");

    const bars = views.map((value, index) => {
      const x = padX + (count === 1 ? innerW / 2 : index * step) - barW / 2;
      const h = (Number(value || 0) / max) * innerH;
      const y = padTop + innerH - h;
      return `<rect class="admin-analytics-chart__bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="5"></rect>`;
    }).join("");

    const dots = views.map((value, index) => {
      const [x, y] = point(value, index).split(",");
      return `<circle class="admin-analytics-chart__dot" cx="${x}" cy="${y}" r="4"><title>${labels[index] || ""}: ${value}</title></circle>`;
    }).join("");

    const visitorDots = visitors.map((value, index) => {
      const [x, y] = point(value, index).split(",");
      return `<circle class="admin-analytics-chart__dot admin-analytics-chart__dot--visitors" cx="${x}" cy="${y}" r="3"><title>${labels[index] || ""}: ${value}</title></circle>`;
    }).join("");

    const visibleLabelStep = Math.max(1, Math.ceil(labels.length / 8));
    const labelEls = labels.map((label, index) => {
      if (index % visibleLabelStep !== 0 && index !== labels.length - 1) return "";
      const x = padX + (count === 1 ? innerW / 2 : index * step);
      return `<text class="admin-analytics-chart__label" x="${x.toFixed(1)}" y="${height - 24}" text-anchor="middle">${label}</text>`;
    }).join("");

    return `
      <svg class="admin-analytics-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="График посещений">
        ${grid}
        ${bars}
        <polyline class="admin-analytics-chart__line" points="${viewsLine}"></polyline>
        <polyline class="admin-analytics-chart__line admin-analytics-chart__line--visitors" points="${visitorsLine}"></polyline>
        ${dots}
        ${visitorDots}
        ${labelEls}
      </svg>
    `;
  }

  function renderTopList(items, emptyText){
    if (!Array.isArray(items) || !items.length) {
      return `<div class="admin-analytics-empty">${emptyText || "Данных пока нет"}</div>`;
    }
    const max = Math.max(1, ...items.map(item => Number(item.count || 0)));
    return items.map(item => {
      const width = Math.max(4, (Number(item.count || 0) / max) * 100);
      return `
        <div class="admin-analytics-row">
          <div class="admin-analytics-row__top">
            <span>${item.title || "Без названия"}</span>
            <b>${formatCount(item.count)}</b>
          </div>
          <i style="width:${width}%"></i>
        </div>
      `;
    }).join("");
  }

  function renderAnalytics(data){
    const modal = document.getElementById("adminAnalyticsModal");
    if (!modal) return;
    const summary = data?.summary || {};
    const body = modal.querySelector(".admin-analytics-body");
    if (!body) return;

    body.innerHTML = `
      <div class="admin-analytics-cards">
        <div class="admin-analytics-card"><small>Всего просмотров</small><strong>${formatCount(summary.total_views)}</strong></div>
        <div class="admin-analytics-card"><small>Посетителей</small><strong>${formatCount(summary.visitors)}</strong></div>
        <div class="admin-analytics-card"><small>Сегодня просмотров</small><strong>${formatCount(summary.today_views)}</strong></div>
        <div class="admin-analytics-card"><small>Сегодня посетителей</small><strong>${formatCount(summary.today_visitors)}</strong></div>
      </div>
      <div class="admin-analytics-meta">
        <span>Первый визит: ${summary.first_visit || "—"}</span>
        <span>Последний визит: ${summary.last_visit || "—"}</span>
      </div>
      <div class="admin-analytics-chart-card">
        <div class="admin-analytics-section-title">График посещений</div>
        <div class="admin-analytics-legend">
          <span><i></i>Просмотры</span>
          <span><i class="is-visitors"></i>Посетители</span>
        </div>
        ${buildSvgChart(data?.chart || {})}
      </div>
      <div class="admin-analytics-columns">
        <section>
          <div class="admin-analytics-section-title">Популярные залы</div>
          ${renderTopList(data?.popular_rooms, "Залы ещё не просматривали")}
        </section>
        <section>
          <div class="admin-analytics-section-title">Популярные экспонаты</div>
          ${renderTopList(data?.popular_exhibits, "Экспонаты ещё не открывали")}
        </section>
      </div>
    `;
  }

  async function loadAnalytics(period = analyticsPeriod){
    analyticsPeriod = period;
    const modal = document.getElementById("adminAnalyticsModal");
    if (!modal) return;
    modal.querySelectorAll("[data-analytics-period]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.analyticsPeriod === analyticsPeriod);
    });
    const body = modal.querySelector(".admin-analytics-body");
    if (body) body.innerHTML = `<div class="admin-analytics-loading">Загружаю статистику…</div>`;
    try {
      const response = await fetch(`/api/admin/analytics?period=${encodeURIComponent(analyticsPeriod)}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Не удалось загрузить статистику");
      renderAnalytics(data);
    } catch (err) {
      if (body) body.innerHTML = `<div class="admin-analytics-empty">${err.message || "Не удалось загрузить статистику"}</div>`;
    }
  }

  function openAnalytics(){
    const modal = document.getElementById("adminAnalyticsModal");
    if (!modal) return;
    modal.classList.add("is-open");
    loadAnalytics(analyticsPeriod);
  }

  function closeAnalytics(){
    document.getElementById("adminAnalyticsModal")?.classList.remove("is-open");
  }

  function buildAnalyticsModal(){
    const modal = document.createElement("div");
    modal.className = "admin-analytics-modal";
    modal.id = "adminAnalyticsModal";
    modal.innerHTML = `
      <div class="admin-analytics-panel" role="dialog" aria-modal="true" aria-label="Статистика посещений">
        <button class="admin-analytics-close" type="button" id="adminCloseAnalytics" aria-label="Закрыть">×</button>
        <h2>Статистика посещений</h2>
        <p>Аналитика сохраняется в <b>data/analytics.json</b> и не пропадает после перезапуска программы.</p>
        <div class="admin-analytics-filters">
          ${Object.entries(analyticsPeriods).map(([key, label]) => `<button type="button" data-analytics-period="${key}">${label}</button>`).join("")}
        </div>
        <div class="admin-analytics-body"></div>
        <div class="admin-analytics-actions">
          <button type="button" id="adminRefreshAnalytics">Обновить</button>
          <button type="button" class="danger" id="adminResetAnalytics">Сбросить</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("adminCloseAnalytics")?.addEventListener("click", closeAnalytics);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeAnalytics();
    });
    modal.querySelectorAll("[data-analytics-period]").forEach(btn => {
      btn.addEventListener("click", () => loadAnalytics(btn.dataset.analyticsPeriod || "days"));
    });
    document.getElementById("adminRefreshAnalytics")?.addEventListener("click", () => loadAnalytics(analyticsPeriod));
    document.getElementById("adminResetAnalytics")?.addEventListener("click", async () => {
      if (!confirm("Сбросить всю статистику посещений?")) return;
      const response = await fetch("/api/admin/analytics/reset", { method: "POST" });
      const data = await response.json();
      if (!data.ok) {
        showNotice(data.error || "Не удалось сбросить статистику", true);
        return;
      }
      showNotice("Статистика сброшена");
      loadAnalytics(analyticsPeriod);
    });
  }

  function buildAdminUi(){
    const panel = document.createElement("div");
    panel.className = "admin-editor-panel";
    panel.innerHTML = `
      <div class="admin-editor-panel__title">Админ</div>
      <button type="button" id="adminToggleEdit">Редактировать</button>
      <button type="button" id="adminAddPoint">+ Точка</button>
      <button type="button" id="adminOpenAnalytics">Статистика</button>
      <a href="/admin/logout">Выйти</a>
    `;
    document.body.appendChild(panel);

    const modal = document.createElement("div");
    modal.className = "admin-point-modal";
    modal.id = "adminPointModal";
    modal.innerHTML = `
      <form class="admin-point-form" id="adminPointForm">
        <button class="admin-point-form__close" type="button" id="adminClosePointForm">×</button>
        <h2>Редактирование точки</h2>

        <div class="admin-form-grid">
          <label>Тип точки
            <select name="point_type">
              <option value="info">Экспонат</option>
              <option value="nav">Переход в комнату</option>
            </select>
          </label>
          <label>X
            <input name="x" type="number" step="0.01" min="0" max="100">
          </label>
          <label>Y
            <input name="y" type="number" step="0.01" min="0" max="100">
          </label>
        </div>

        <label>Подпись точки
          <input name="tooltip" placeholder="Название при наведении">
        </label>

        <div class="admin-info-fields">
          <label>Название экспоната
            <input name="title" placeholder="Название экспоната">
          </label>
          <label>Описание
            <textarea name="description" rows="9" placeholder="Описание экспоната"></textarea>
          </label>
          <label>Текущее изображение / путь
            <input name="image" placeholder="/static/assets/...">
          </label>
          <label>Загрузить новое изображение
            <input name="image_file" type="file" accept="image/*">
          </label>
          <input name="is_masterpiece_present" type="hidden" value="1">
          <label class="admin-masterpiece-label">
            <input name="is_masterpiece" type="checkbox" value="1">
            <span>
              Показывать в «Шедеврах коллекции»
              <small>Отмеченные экспонаты появятся в листаемом блоке на главной странице.</small>
            </span>
          </label>
          <input name="link" type="hidden">
        </div>

        <div class="admin-nav-fields">
          <label>Куда перейти
            <select name="href">
              <option value="komnata1">Зал 1: История ЛДПК: становление и развитие</option>
              <option value="komnata2">Комната 2</option>
              <option value="komnata3">Комната 3</option>
              <option value="komnata4">Комната 4</option>
            </select>
          </label>
        </div>

        <div class="admin-point-actions">
          <button type="submit">Сохранить</button>
          <button type="button" class="danger" id="adminDeletePoint">Удалить</button>
        </div>
      </form>
    `;
    document.body.appendChild(modal);
    buildAnalyticsModal();

    document.getElementById("adminOpenAnalytics")?.addEventListener("click", openAnalytics);

    document.getElementById("adminToggleEdit")?.addEventListener("click", () => {
      editMode = !editMode;
      addMode = false;
      document.body.classList.toggle("admin-edit-mode", editMode);
      document.getElementById("adminToggleEdit").classList.toggle("is-active", editMode);
      showNotice(editMode ? "Режим редактирования включен" : "Режим редактирования выключен");
    });

    document.getElementById("adminAddPoint")?.addEventListener("click", () => {
      editMode = true;
      addMode = true;
      document.body.classList.add("admin-edit-mode", "admin-add-mode");
      document.getElementById("adminToggleEdit")?.classList.add("is-active");
      showNotice("Кликни по панораме, чтобы поставить новую точку");
    });

    document.getElementById("adminClosePointForm")?.addEventListener("click", closeEditor);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeEditor();
    });

    document.getElementById("adminDeletePoint")?.addEventListener("click", () => {
      if (selectedPoint) deletePoint(selectedPoint);
    });

    document.getElementById("adminPointForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedPoint) return;

      const formData = new FormData(e.currentTarget);
      const updated = await savePoint(selectedPoint, formData);
      if (!updated) return;

      showNotice("Сохранено");
      window.location.reload();
    });

    document.querySelector("select[name='point_type']")?.addEventListener("change", (e) => {
      document.body.classList.toggle("admin-form-nav", e.target.value === "nav");
    });
  }

  pointsContainer.addEventListener("click", (e) => {
    if (!editMode) return;
    const pointEl = e.target.closest(".point");
    if (!pointEl) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const point = findPoint(pointEl.dataset.pointId);
    if (point) openEditor(point);
  }, true);

  pointsContainer.addEventListener("pointerdown", (e) => {
    if (!editMode) return;
    const pointEl = e.target.closest(".point");
    if (!pointEl) return;

    const point = findPoint(pointEl.dataset.pointId);
    if (!point) return;

    dragging = {
      el: pointEl,
      point,
      moved: false
    };

    pointEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);

  pointsContainer.addEventListener("pointermove", (e) => {
    if (!dragging || !editMode) return;
    const pos = getPointPositionFromEvent(e);
    dragging.point.x = pos.x;
    dragging.point.y = pos.y;
    dragging.el.style.left = `${pos.x}%`;
    dragging.el.style.top = `${pos.y}%`;
    dragging.moved = true;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  pointsContainer.addEventListener("pointerup", async (e) => {
    if (!dragging) return;
    const item = dragging;
    dragging = null;

    if (item.moved) {
      const fd = new FormData();
      fd.set("point_type", pointType(item.point));
      fd.set("x", item.point.x);
      fd.set("y", item.point.y);
      fd.set("tooltip", item.point.tooltip || "");
      fd.set("href", item.point.href || "");
      fd.set("title", item.point.info?.title || item.point.tooltip || "");
      fd.set("description", item.point.info?.description || "");
      fd.set("image", item.point.info?.image || "");
      fd.set("link", item.point.info?.link || item.point.info?.image || "");
      if (item.point.info?.is_masterpiece || item.point.info?.masterpiece || item.point.info?.featured) {
        fd.set("is_masterpiece", "1");
      }
      await savePoint(item.point, fd);
      showNotice("Координаты сохранены");
    }

    e.preventDefault();
    e.stopPropagation();
  }, true);


  scene.addEventListener("pointerdown", (e) => {
    if (!addMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);

  scene.addEventListener("click", async (e) => {
    if (!addMode) return;
    if (e.target.closest(".point")) return;
    addMode = false;
    document.body.classList.remove("admin-add-mode");
    e.preventDefault();
    e.stopPropagation();
    await createPointAt(e);
  }, true);

  buildAdminUi();
})();
