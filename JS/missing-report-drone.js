(() => {
  "use strict";

  const STORAGE_KEY = "missing_report_page_v2";

  const STATUSES = {
    accepted:  { label: "مقبول",     dot: "var(--oak-400)" },
    searching: { label: "جاري البحث", dot: "var(--oak-500)" },
    found:     { label: "تم العثور", dot: "var(--olive-500)" },
    rescued:   { label: "تم الإنقاذ", dot: "#3b82f6" },
  };

  const DEFAULT_STATE = {
    report: {
      id: "BLG-0002",
      missingName: "سلمان الدوسري",
      missingAge: "28",
      missingArea: "الرياض — رماح",
      reportTime: new Date(Date.now() - 1000 * 60 * 35).toLocaleString("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      details:
        "تم الإبلاغ عن فقدان الشخص بعد خروجه للتنزه في منطقة صحراوية. آخر تواصل كان قبل 3 ساعات. يرتدي ثوبًا أبيض وشماغًا أحمر.",
      status: "searching",
      videoSource: "Drone-01",
    },

    drone: {
      pos: { lat: 24.995, lng: 46.74 },
      path: [
        { lat: 24.992, lng: 46.71 },
        { lat: 24.993, lng: 46.717 },
        { lat: 24.9942, lng: 46.724 },
        { lat: 24.9948, lng: 46.732 },
        { lat: 24.995, lng: 46.74 },
        { lat: 24.9958, lng: 46.748 },
        { lat: 24.9964, lng: 46.756 },
        { lat: 24.996, lng: 46.764 },
      ],
    },

    alerts: [
      {
        id: crypto.randomUUID(),
        lat: 24.9942,
        lng: 46.724,
        ts: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        desc: "اشتباه وجود بشري بالقرب من كثبان منخفضة.",
        imgDataUrl: null,
        read: false,
      },
      {
        id: crypto.randomUUID(),
        lat: 24.9958,
        lng: 46.748,
        ts: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        desc: "رصد حركة محتملة بجانب مسار رملي.",
        imgDataUrl: null,
        read: false,
      },
    ],
  };

  const $ = (sel) => document.querySelector(sel);

  let state = null;
  let activeAlertId = null;

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);

    try {
      const s = JSON.parse(raw);
      return {
        report: { ...structuredClone(DEFAULT_STATE.report), ...(s.report || {}) },
        drone: { ...structuredClone(DEFAULT_STATE.drone), ...(s.drone || {}) },
        alerts: Array.isArray(s.alerts) ? s.alerts : structuredClone(DEFAULT_STATE.alerts),
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function demoImg(label) {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 540;
    const g = c.getContext("2d");

    const grd = g.createLinearGradient(0, 0, c.width, c.height);
    grd.addColorStop(0, "rgba(166,124,82,0.14)");
    grd.addColorStop(1, "rgba(122,154,106,0.10)");
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);

    g.strokeStyle = "rgba(166,124,82,0.55)";
    g.lineWidth = 10;
    g.strokeRect(20, 20, c.width - 40, c.height - 40);

    g.fillStyle = "rgba(42,31,18,0.90)";
    g.font = "900 54px Tajawal, sans-serif";
    g.fillText("AI Capture", 60, 110);

    g.fillStyle = "rgba(74,56,40,0.80)";
    g.font = "700 28px Tajawal, sans-serif";
    g.fillText(label, 60, 160);

    g.fillStyle = "rgba(74,56,40,0.75)";
    g.font = "600 22px Tajawal, sans-serif";
    g.fillText("Demo frame - replace with real snapshot", 60, 210);

    g.beginPath();
    g.fillStyle = "rgba(194,59,46,0.35)";
    g.arc(720, 260, 44, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "rgba(42,31,18,0.90)";
    g.font = "900 22px Tajawal, sans-serif";
    g.fillText("?", 712, 268);

    return c.toDataURL("image/jpeg", 0.85);
  }

  function ensureImages() {
    for (const a of state.alerts) {
      if (!a.imgDataUrl) a.imgDataUrl = demoImg("AI Alert");
    }
  }

  function showToast(msg) {
    const box = $("#toastBox");
    const text = $("#toastText");
    if (!box || !text) return;

    text.textContent = msg;
    box.style.display = "inline-flex";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      box.style.display = "none";
    }, 2200);
  }

  function unreadCount() {
    return state.alerts.filter((a) => !a.read).length;
  }

  function setHeader() {
    const id = state.report.id;

    const reportIdEl = $("#reportId");
    if (reportIdEl) reportIdEl.textContent = id;

    const titleEl = $("#reportTitleId");
    if (titleEl) titleEl.textContent = id;

    const lastUpdatedEl = $("#lastUpdated");
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = new Date().toLocaleString("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }

    const unreadEl = $("#unreadCount");
    if (unreadEl) unreadEl.textContent = String(unreadCount());

    const st = STATUSES[state.report.status] || STATUSES.searching;

    const statusTextEl = $("#statusText");
    if (statusTextEl) statusTextEl.textContent = st.label;

    const statusDotEl = $("#statusDot");
    if (statusDotEl) statusDotEl.style.background = st.dot;
  }

  function setReport() {
    const r = state.report;

    const nameEl = $("#missingName");
    if (nameEl) nameEl.textContent = r.missingName;

    const ageEl = $("#missingAge");
    if (ageEl) ageEl.textContent = r.missingAge;

    const areaEl = $("#missingArea");
    if (areaEl) areaEl.textContent = r.missingArea;

    const timeEl = $("#reportTime");
    if (timeEl) timeEl.textContent = r.reportTime;

    const detailsEl = $("#reportDetails");
    if (detailsEl) detailsEl.textContent = r.details;

    const videoEl = $("#videoSource");
    if (videoEl) videoEl.textContent = r.videoSource;

    const selectEl = $("#statusSelect");
    if (selectEl) selectEl.value = r.status;

    setHeader();
  }

  function wireEvents() {
    const saveBtn = $("#saveStatusBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const sel = $("#statusSelect");
        if (!sel) return;
        state.report.status = sel.value;
        saveState();
        setHeader();

        const hint = $("#statusSavedHint");
        if (hint) hint.style.display = "inline-flex";

        showToast("تم حفظ حالة البلاغ");
        setTimeout(() => {
          const h = $("#statusSavedHint");
          if (h) h.style.display = "none";
        }, 1600);
      });
    }

    const closeBtn = $("#closeAlertModalBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeAlert);

    const backdrop = $("#alertModalBackdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeAlert();
      });
    }

    document.addEventListener("keydown", (e) => {
      const bd = $("#alertModalBackdrop");
      if (e.key === "Escape" && bd && bd.style.display === "flex") closeAlert();
    });

    const markBtn = $("#markReadBtn");
    if (markBtn) {
      markBtn.addEventListener("click", () => {
        if (!activeAlertId) return;
        const a = state.alerts.find((x) => x.id === activeAlertId);
        if (!a) return;

        a.read = true;
        saveState();
        setHeader();
        draw();
        showToast("تم تعليم التنبيه كمقروء");
        closeAlert();
      });
    }

    const map = $("#mapCanvas");
    if (map) {
      map.addEventListener("click", (e) => {
        const rect = map.getBoundingClientRect();
        const sx = map.width / rect.width;
        const sy = map.height / rect.height;
        const mx = (e.clientX - rect.left) * sx;
        const my = (e.clientY - rect.top) * sy;

        const a = pickAlertAt(mx, my);
        if (a) openAlert(a.id);
      });
    }
  }

  function getCanvas() {
    return $("#mapCanvas");
  }

  function getCtx() {
    const c = getCanvas();
    return c ? c.getContext("2d") : null;
  }

  function boundsFromState() {
    const pts = [
      ...state.drone.path,
      state.drone.pos,
      ...state.alerts.map((a) => ({ lat: a.lat, lng: a.lng })),
    ];

    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;

    for (const p of pts) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }

    const padLat = (maxLat - minLat || 0.01) * 0.25;
    const padLng = (maxLng - minLng || 0.01) * 0.25;

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    };
  }

  function project(p, b, w, h) {
    const x = ((p.lng - b.minLng) / (b.maxLng - b.minLng)) * w;
    const y = (1 - (p.lat - b.minLat) / (b.maxLat - b.minLat)) * h;
    return { x, y };
  }

  function rgba(r, g, b, a) {
    return `rgba(${r},${g},${b},${a})`;
  }

  function parseCssColorToRgb(css) {
    const tmp = document.createElement("div");
    tmp.style.color = css;
    document.body.appendChild(tmp);
    const out = getComputedStyle(tmp).color;
    tmp.remove();

    const m = out.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function draw() {
    const c = getCanvas();
    const g = getCtx();
    if (!c || !g) return;

    const b = boundsFromState();

    g.clearRect(0, 0, c.width, c.height);

    const bg = g.createLinearGradient(0, 0, c.width, c.height);
    bg.addColorStop(0, "rgba(166,124,82,0.10)");
    bg.addColorStop(1, "rgba(122,154,106,0.07)");
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);

    g.strokeStyle = "rgba(166,124,82,0.22)";
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      const y = (i + 1) * (c.height / 10);
      g.moveTo(0, y);
      g.bezierCurveTo(c.width * 0.25, y - 30, c.width * 0.55, y + 30, c.width, y);
      g.stroke();
    }

    const pathPx = state.drone.path.map((p) => project(p, b, c.width, c.height));
    g.setLineDash([10, 10]);
    g.strokeStyle = "rgba(74,56,40,0.28)";
    g.lineWidth = 4;
    g.beginPath();
    pathPx.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.stroke();
    g.setLineDash([]);

    g.fillStyle = "rgba(74,56,40,0.18)";
    for (const p of pathPx) {
      g.beginPath();
      g.arc(p.x, p.y, 5, 0, Math.PI * 2);
      g.fill();
    }

    const blue = "#3b82f6";
    const red = "#ef4444";
    const green = "#22c55e";

    for (const a of state.alerts) {
      const p = project({ lat: a.lat, lng: a.lng }, b, c.width, c.height);
      const color = a.read ? green : red;
      const rgb = parseCssColorToRgb(color);

      g.beginPath();
      g.fillStyle = rgba(rgb.r, rgb.g, rgb.b, 0.16);
      g.arc(p.x, p.y, 18, 0, Math.PI * 2);
      g.fill();

      g.beginPath();
      g.fillStyle = color;
      g.arc(p.x, p.y, 8, 0, Math.PI * 2);
      g.fill();

      g.beginPath();
      g.strokeStyle = "rgba(166,124,82,0.55)";
      g.lineWidth = 2;
      g.arc(p.x, p.y, 8, 0, Math.PI * 2);
      g.stroke();
    }

    const dp = project(state.drone.pos, b, c.width, c.height);
    const rgbB = parseCssColorToRgb(blue);

    g.beginPath();
    g.fillStyle = rgba(rgbB.r, rgbB.g, rgbB.b, 0.16);
    g.arc(dp.x, dp.y, 22, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.fillStyle = blue;
    g.arc(dp.x, dp.y, 10, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.strokeStyle = "rgba(166,124,82,0.55)";
    g.lineWidth = 2;
    g.arc(dp.x, dp.y, 10, 0, Math.PI * 2);
    g.stroke();

    g.fillStyle = "rgba(42,31,18,0.82)";
    g.font = "900 16px Tajawal, sans-serif";
    g.fillText("DRONE", dp.x + 14, dp.y - 14);
  }

  function pickAlertAt(mx, my) {
    const c = getCanvas();
    if (!c) return null;

    const b = boundsFromState();
    const threshold = 14;

    for (const a of state.alerts) {
      const p = project({ lat: a.lat, lng: a.lng }, b, c.width, c.height);
      const dx = mx - p.x;
      const dy = my - p.y;
      if (Math.sqrt(dx * dx + dy * dy) <= threshold) return a;
    }
    return null;
  }

  function formatAr(tsIso) {
    const d = new Date(tsIso);
    return d.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  }

  function openAlert(alertId) {
    const a = state.alerts.find((x) => x.id === alertId);
    if (!a) return;

    activeAlertId = alertId;

    const img = $("#alertImg");
    if (img) img.src = a.imgDataUrl;

    const t = $("#alertTime");
    if (t) t.textContent = formatAr(a.ts);

    const loc = $("#alertLocation");
    if (loc) loc.textContent = `${a.lat.toFixed(6)}, ${a.lng.toFixed(6)}`;

    const desc = $("#alertDesc");
    if (desc) desc.textContent = a.desc;

    const markBtn = $("#markReadBtn");
    if (markBtn) markBtn.style.display = a.read ? "none" : "inline-flex";

    const bd = $("#alertModalBackdrop");
    if (bd) bd.style.display = "flex";
  }

  function closeAlert() {
    const bd = $("#alertModalBackdrop");
    if (bd) bd.style.display = "none";
    activeAlertId = null;
  }

  function applyModelEvent(event) {
    if (event?.type !== "human_detected") return;

    state.alerts.unshift({
      id: crypto.randomUUID(),
      lat: event.lat,
      lng: event.lng,
      ts: event.ts || new Date().toISOString(),
      desc: event.desc || "تنبيه: تم رصد مؤشر بشري.",
      imgDataUrl: event.imgDataUrl || demoImg("AI Alert"),
      read: false,
    });

    state.alerts = state.alerts.slice(0, 50);
    saveState();
    setHeader();
    draw();
    showToast("وصل تنبيه جديد");
  }

  function startSim() {
    setInterval(() => {
      if (Math.random() < 0.35) {
        const base = state.drone.pos;
        const jitter = () => (Math.random() - 0.5) * 0.02;

        applyModelEvent({
          type: "human_detected",
          lat: base.lat + jitter(),
          lng: base.lng + jitter(),
          ts: new Date().toISOString(),
          desc: "تنبيه تلقائي: تم رصد مؤشر بشري (محاكاة).",
          imgDataUrl: demoImg("Auto Alert"),
        });
      }
    }, 8000);
  }

  function hardForceTitleOnce() {
    const id = state?.report?.id || "—";
    const el = $("#reportTitleId");
    if (el) el.textContent = id;
  }

  function init() {
    state = loadState();
    ensureImages();
    setReport();
    hardForceTitleOnce();
    draw();
    wireEvents();
    startSim();

    setTimeout(hardForceTitleOnce, 50);
    setTimeout(hardForceTitleOnce, 200);
  }

  document.addEventListener("DOMContentLoaded", init);
})();