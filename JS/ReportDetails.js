// /JS/RealTimeReportDetails.js
(() => {
  "use strict";

  const STORAGE_KEY = "missing_report_page_v2";

  const STATUSES = {
    // Firestore values
    "Under Review":  { label: "قيد المراجعة",          dot: "var(--oak-400)" },
    "under_review":  { label: "قيد المراجعة",          dot: "var(--oak-400)" },
    "org":           { label: "قيد المراجعة",          dot: "var(--oak-400)" },
    "accepted":      { label: "مقبول",                 dot: "var(--oak-400)" },
    "active":        { label: "جاري البحث",            dot: "var(--oak-500)" },
    "search_in_progress": { label: "جاري البحث",       dot: "var(--oak-500)" },
    "searching":     { label: "جاري البحث",            dot: "var(--oak-500)" },
    "found":         { label: "تم العثور",             dot: "var(--olive-500)" },
    "rescued":       { label: "تم إغلاق البلاغ",       dot: "#6b7280" },
    "report_closed": { label: "تم إغلاق البلاغ",       dot: "#6b7280" },
    "closed":        { label: "تم إغلاق البلاغ",       dot: "#6b7280" },
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
      },
      {
        id: crypto.randomUUID(),
        lat: 24.9958,
        lng: 46.748,
        ts: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        desc: "رصد حركة محتملة بجانب مسار رملي.",
        imgDataUrl: null,
      },
    ],
  };

  const $ = (sel) => document.querySelector(sel);

  let state = null;
  let activeAlertId = null;

  // -------- Storage ----------
  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);

    try {
      const s = JSON.parse(raw);
      return {
        report: { ...structuredClone(DEFAULT_STATE.report), ...(s.report || {}) },
        drone: { ...structuredClone(DEFAULT_STATE.drone), ...(s.drone || {}) },
        alerts: Array.isArray(s.alerts)
          ? s.alerts.map((a) => {
              const { read, ...rest } = a || {};
              return rest;
            })
          : structuredClone(DEFAULT_STATE.alerts),
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // -------- Demo image ----------
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

  // -------- UI ----------
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
    return state.alerts.length;
  }

  function forceTitles() {
    const id = state?.report?.id || "—";

    const reportIdEl = $("#reportId");
    if (reportIdEl) reportIdEl.textContent = id;

    const topTitleEl = $("#reportTitleId");
    if (topTitleEl) topTitleEl.textContent = id;

    const bigTitleEl = $("#bigReportTitleId");
    if (bigTitleEl) bigTitleEl.textContent = id;

    try { document.title = `${id} - التفاصيل وتتبع الدرون`; } catch {}
  }

  function setHeader() {
    forceTitles();

    const lastUpdatedEl = $("#lastUpdated");
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = new Date().toLocaleString("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }

    const unreadEl = $("#unreadCount");
    if (unreadEl) unreadEl.textContent = String(unreadCount());

    const st = STATUSES[state.report.status] || STATUSES["Under Review"];

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

    // حقول إضافية
    const healthEl = $("#missingHealth");
    if (healthEl) healthEl.textContent = r.healthStatus || '—';

    const vehicleEl = $("#missingVehicle");
    if (vehicleEl) vehicleEl.textContent = r.vehicle || '—';

    const contactEl = $("#reportContact");
    if (contactEl) contactEl.textContent = r.contact || '—';

    // ADDED: عرض ملف الدليل المرفوع من المُبلّغ ─────────────────────────
    const evidenceBox = $("#evidenceContainer");
    if (evidenceBox) {
      if (r.evidenceFile) {
        if (r.evidenceFileType === 'image') {
          // صورة — تعرض مصغّرة وتفتح كاملة بضغطة
          evidenceBox.innerHTML = `
            <a href="${r.evidenceFile}" target="_blank" title="فتح الصورة بالحجم الكامل">
              <img src="${r.evidenceFile}" alt="صورة الدليل"
                style="max-width:100%;max-height:280px;border-radius:10px;
                       object-fit:contain;cursor:pointer;border:1.5px solid rgba(166,124,82,0.3);" />
            </a>
            <div style="font-size:12px;color:#999;margin-top:6px;">اضغط على الصورة لعرضها كاملة</div>`;
        } else if (r.evidenceFileType === 'video') {
          // فيديو — مشغّل مباشر
          evidenceBox.innerHTML = `
            <video controls style="max-width:100%;max-height:280px;border-radius:10px;border:1.5px solid rgba(166,124,82,0.3);">
              <source src="${r.evidenceFile}">
              متصفحك لا يدعم تشغيل الفيديو.
            </video>`;
        } else if (r.evidenceFileType === 'pdf') {
          // PDF — رابط تحميل
          evidenceBox.innerHTML = `
            <a href="${r.evidenceFile}" target="_blank"
              style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;
                     background:#f5f5f5;border:1.5px solid rgba(166,124,82,0.3);
                     border-radius:8px;color:#333;text-decoration:none;font-weight:600;">
              📄 فتح ملف PDF
            </a>`;
        }
      } else {
        evidenceBox.innerHTML = `<span style="color:#aaa;font-size:13px;">لا يوجد ملف مرفق</span>`;
      }
    }
    // END ADDED ────────────────────────────────────────────────────────

    const leaderEl = $("#reportLeader");
    if (leaderEl) leaderEl.textContent = r.leader || '—';

    const volCountEl = $("#reportVolCount");
    if (volCountEl) volCountEl.textContent = r.teamCount != null ? toArNum(r.teamCount) + ' متطوع' : '—';

    const selectEl = $("#statusSelect");
    if (selectEl) selectEl.value = r.status;

    setHeader();
  }

  // -------- Map helpers ----------
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

    for (const a of state.alerts) {
      const p = project({ lat: a.lat, lng: a.lng }, b, c.width, c.height);
      const rgb = parseCssColorToRgb(red);

      g.beginPath();
      g.fillStyle = rgba(rgb.r, rgb.g, rgb.b, 0.16);
      g.arc(p.x, p.y, 18, 0, Math.PI * 2);
      g.fill();

      g.beginPath();
      g.fillStyle = red;
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

  // -------- Modal ----------
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
    if (markBtn) markBtn.style.display = "none";

    const bd = $("#alertModalBackdrop");
    if (bd) bd.style.display = "flex";
  }

  function closeAlert() {
    const bd = $("#alertModalBackdrop");
    if (bd) bd.style.display = "none";
    activeAlertId = null;
  }

  // -------- Events ----------
  // ── Firestore status update (leader only) ─────────────────────────
  async function saveStatusToFirestore(newStatus) {
    // Use whichever doc ID is available — _leaderDocId is set after the async
    // leader check; _currentReportDocId is set immediately from the URL.
    const docId = window._leaderDocId || window._currentReportDocId || null;
    if (!docId) { console.warn('saveStatusToFirestore: no docId'); return; }

    // Extra guard: only the confirmed leader may write
    if (window._isLeader === false) {
      console.warn('saveStatusToFirestore: blocked — not the leader');
      return;
    }

    try {
      const { initializeApp, getApps } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
      );
      const { getFirestore, doc, updateDoc } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );

      const firebaseConfig = {
        apiKey:            'AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0',
        authDomain:        'rasid-1bb06.firebaseapp.com',
        projectId:         'rasid-1bb06',
        storageBucket:     'rasid-1bb06.firebasestorage.app',
        messagingSenderId: '668525115587',
        appId:             '1:668525115587:web:e017be3b5cbf4ac3b30a76',
      };
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const db  = getFirestore(app);

      await updateDoc(doc(db, 'Report', docId), {
        status:     newStatus,
        lastUpdate: new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }),
      });
    } catch (err) {
      console.error('saveStatusToFirestore error:', err);
    }
  }

  function wireEvents() {
    // NOTE: Status updates are now handled exclusively by the modal
    // (openStatusModal / submitStatusUpdate) in the HTML.
    // The old #saveStatusBtn element no longer exists in the page.

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

  // -------- Feed (simulation) ----------
  function applyModelEvent(event) {
    if (event?.type !== "human_detected") return;

    state.alerts.unshift({
      id: crypto.randomUUID(),
      lat: event.lat,
      lng: event.lng,
      ts: event.ts || new Date().toISOString(),
      desc: event.desc || "تنبيه: تم رصد مؤشر بشري.",
      imgDataUrl: event.imgDataUrl || demoImg("AI Alert"),
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

  // -------- Init ----------
  // ── تحميل بيانات البلاغ من Firestore ──────────────────────────────
  async function loadFromFirestore(docId) {
    try {
      const { initializeApp, getApps } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
      );
      const { getFirestore, doc, getDoc } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
      const firebaseConfig = {
        apiKey:            'AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0',
        authDomain:        'rasid-1bb06.firebaseapp.com',
        projectId:         'rasid-1bb06',
        storageBucket:     'rasid-1bb06.firebasestorage.app',
        messagingSenderId: '668525115587',
        appId:             '1:668525115587:web:e017be3b5cbf4ac3b30a76',
      };
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const db  = getFirestore(app);

      const snap = await getDoc(doc(db, 'Report', docId));
      if (!snap.exists()) return null;

      const d = snap.data();
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      let reportTimeStr = '—';

if (d.LoggedAt && d.LoggedAt.toDate) {

  const dt = d.LoggedAt.toDate();

  reportTimeStr = dt.toLocaleString('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

} else if (d.ReportDate) {

  reportTimeStr = d.ReportDate;

}

      return {
        id:           d.reportId || docId,
        missingName:  d.MissingPersonName || d.MisssionPersoneName || d.missingPersonName || '—',
        missingAge:   d.Age ? d.Age + ' سنة' : (d.age ? d.age + ' سنة' : '—'),
        missingArea:  d.Region || d.location || '—',
        reportTime:   reportTimeStr,
        details:      d.Details || d.description || 'لا توجد تفاصيل.',
        status:       d.Status || d.status || 'Under Review',
        videoSource:  'Drone-01',
        leader:       d.leader || '—',
        leaderPhone:  d.leaderPhone || '—',
        lastUpdate:   d.lastUpdate || '—',
        healthStatus: d.HealthStatus || d.healthStatus || 'لا يوجد',
        vehicle:      d.Vehicle || d.vehicle || '—',
        contact:      d.contact || d.ReporterEmail || '—',
        teamCount:    Array.isArray(d.teamMembers) ? d.teamMembers.length : 0,
        evidenceFile:     d.EvidanceFile || d.EvidenceFile || d.evidenceFile || '',
        evidenceFileType: d.EvidenceFileType || d.evidenceFileType || 'image',
      };
    } catch (err) {
      console.error('loadFromFirestore error:', err);
      return null;
    }
  }

  function init() {
    // نضع docId من URL في window حتى يقرأه الـ module script للتحقق من الليدر
    const _params = new URLSearchParams(window.location.search);
    window._currentReportDocId = _params.get('docId') || null;

    state = loadState();
    ensureImages();

    // إذا في docId في URL — نحمّل البيانات الحقيقية من Firestore
    if (window._currentReportDocId) {
      loadFromFirestore(window._currentReportDocId).then(function(reportData) {
        if (reportData) {
          // نحدّث state.report بالبيانات الحقيقية
          state.report.id          = reportData.id;
          state.report.missingName = reportData.missingName;
          state.report.missingAge  = reportData.missingAge;
          state.report.missingArea = reportData.missingArea;
          state.report.reportTime  = reportData.reportTime;
          state.report.details      = reportData.details;
          state.report.status       = reportData.status;
          state.report.videoSource  = reportData.videoSource;
          state.report.healthStatus = reportData.healthStatus;
          state.report.vehicle      = reportData.vehicle;
          state.report.contact      = reportData.contact;
          state.report.leader       = reportData.leader;
          state.report.teamCount    = reportData.teamCount;
          // ADDED: تمرير بيانات ملف الدليل إلى الـ state
          state.report.evidenceFile     = reportData.evidenceFile;
          state.report.evidenceFileType = reportData.evidenceFileType;

          // نخزن معلومات إضافية للاستخدام لاحقاً
          window._reportLeader      = reportData.leader;
          window._reportLeaderPhone = reportData.leaderPhone;
          window._reportLastUpdate  = reportData.lastUpdate;

          setReport();
          setHeader();

          // نحدّث عنوان الـ select بالحالة الصحيحة
          const sel = $("#statusSelect");
          if (sel) sel.value = reportData.status;
        }
      });
    }

    setReport();
    draw();
    wireEvents();
    startSim();

    setTimeout(setHeader, 50);
    setTimeout(setHeader, 200);
    setTimeout(setHeader, 500);
  }

  document.addEventListener("DOMContentLoaded", init);
})();