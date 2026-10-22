// ============================================================
//  RASID – Detections hub (user story 33)
// ------------------------------------------------------------
//  ONE source of truth for detections on RealTimeReportDetails.html.
//  Everything (notification, list, map pins, video labels) shows the SAME
//  detection with the SAME number, colour and status:
//
//      #3  شخص 64%   [مؤكَّد]      <- list row
//      (3)                          <- red/green/grey pin on the map
//      #3 شخص 64%                   <- label on the live video
//
//  - Detections are grouped by drone MISSION (each start of the drone = new
//    mission). Tabs above the list: "المهمة 2 · مباشر", "المهمة 1 · 1:37 م".
//    The list AND the map show only the selected mission.
//  - New detection -> ping sound + ONE notification (person / car / moto)
//  - Click a list row or a notification -> details window + the map jumps to the pin
//  - Click a pin on the map -> its row is highlighted
//  - Status (new / confirmed / false alarm / duplicate) is changed in ONE place
//    (details window) and updates everywhere at once (Firestore live listener).
//
//  Shares with the map:   window 'rasid:detections'  {missionId, items, isLive}
//                         window 'rasid:select'      {id}   (map pin clicked)
//  API:  window.RasidDetections.open(id) / .list() / .numberOf(id) / .status
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0",
  authDomain: "rasid-1bb06.firebaseapp.com",
  projectId: "rasid-1bb06",
  storageBucket: "rasid-1bb06.firebasestorage.app",
  messagingSenderId: "668525115587",
  appId: "1:668525115587:web:e017be3b5cbf4ac3b30a76",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ONE colour + name per status, used by list, map, notifications and video
const STATUS = {
  new:         { ar: "بحاجة لتحقق", color: "#dc2626" },
  confirmed:   { ar: "مؤكَّد",       color: "#16a34a" },
  false_alarm: { ar: "إنذار خاطئ",   color: "#9ca3af" },
  duplicate:   { ar: "مكرر",         color: "#9ca3af" },
};
const CLASS_AR = { person: "شخص", car: "سيارة", moto: "دراجة نارية" };
const CLASS_ICON = { person: "🧍", car: "🚗", moto: "🏍️" };

const docId = new URLSearchParams(location.search).get("docId");
const detections = new Map();          // id -> data (+ _num, _mission)
let missions = [];                     // [{id, num, start, count}] oldest first
let selectedMission = null;            // mission shown in list + map
let userPickedMission = false;         // stop auto-switching once the user picks a tab
let liveMission = null;                // mission currently streaming (from droneStream.js)
let firstSnapshot = true;
let highlighted = null;
let soundOn = readPref("rasidSound", "1") === "1";
let listEl, countEl, tabsEl;

injectStyles();
if (docId) start();

// ---------------------------------------------------------------- data
function start() {
  buildPanel();
  window.addEventListener("rasid:telemetry", (e) => {
    const m = e.detail && e.detail.missionId;
    if (m && m !== liveMission) {
      liveMission = m;
      if (!userPickedMission) selectedMission = m;      // follow the live mission
      refresh();
    }
  });
  window.addEventListener("rasid:select", (e) => highlight(e.detail && e.detail.id, true));

  const q = query(collection(db, "Detection"), where("ReportID", "==", docId));
  onSnapshot(q, (snap) => {
    const added = [];
    snap.docChanges().forEach((ch) => {
      const d = { id: ch.doc.id, ...ch.doc.data() };
      if (ch.type === "removed") { detections.delete(d.id); return; }
      detections.set(d.id, d);
      if (ch.type === "added" && !firstSnapshot) added.push(d.id);
    });
    firstSnapshot = false;
    refresh();
    added.forEach((id) => notify(detections.get(id)));   // after refresh: numbers are known
  }, (err) => {
    console.error("[RASID] Detection listener error:", err);
    if (countEl) countEl.textContent = "تعذّر تحميل الاكتشافات (صلاحيات قاعدة البيانات)";
  });
}

function timeOf(d) {
  if (d.TimeStamp && d.TimeStamp.toDate) return d.TimeStamp.toDate().getTime();
  if (d.FrameTime) return Date.parse(d.FrameTime) || Date.now();
  return Date.now();                         // just written, server time not back yet
}

function refresh() {
  // group by mission, oldest mission = 1
  const byMission = new Map();
  for (const d of detections.values()) {
    const m = d.VideoID || "unknown";
    if (!byMission.has(m)) byMission.set(m, []);
    byMission.get(m).push(d);
  }
  if (liveMission && !byMission.has(liveMission)) byMission.set(liveMission, []);
  missions = [...byMission.entries()].map(([id, items]) => {
    items.sort((a, b) => timeOf(a) - timeOf(b));
    items.forEach((d, i) => { d._num = i + 1; d._mission = id; });     // #1, #2 ... inside each mission
    return { id, items, start: items.length ? timeOf(items[0]) : Date.now(), count: items.length };
  }).sort((a, b) => a.start - b.start);
  missions.forEach((m, i) => (m.num = i + 1));

  if (!selectedMission || !missions.some((m) => m.id === selectedMission)) {
    selectedMission = (missions.find((m) => m.id === liveMission) || missions[missions.length - 1] || {}).id || null;
  }
  renderTabs();
  renderList();
  window.dispatchEvent(new CustomEvent("rasid:detections", {
    detail: { missionId: selectedMission, isLive: selectedMission === liveMission, items: currentItems() },
  }));
}

function currentItems() {
  const m = missions.find((x) => x.id === selectedMission);
  return m ? m.items.map(decorate) : [];
}
function decorate(d) {                // extra fields every view uses the same way
  const st = STATUS[d.Status] || STATUS.new;
  return Object.assign(d, { _statusAr: st.ar, _color: st.color, _classAr: CLASS_AR[d.Class] || d.ClassAr || d.Class,
                            _icon: CLASS_ICON[d.Class] || "📍" });
}

// ---------------------------------------------------------------- formatting
function isToday(ms) { return new Date(ms).toDateString() === new Date().toDateString(); }
function fmtDay(ms) { return new Date(ms).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" }); }
function fmtTime(ms) {               // today: time only, older: date + time
  const t = new Date(ms).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return isToday(ms) ? t : `${fmtDay(ms)} · ${t}`;
}
function fmtShort(ms) {
  const t = new Date(ms).toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" });
  return isToday(ms) ? t : `${fmtDay(ms)} ${t}`;
}
function fmtCoords(d) { return `${Number(d.Latitude).toFixed(6)}, ${Number(d.Longitude).toFixed(6)}`; }
function pct(v) { return Math.round((v || 0) * 100) + "%"; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function readPref(k, def) { try { return localStorage.getItem(k) ?? def; } catch (e) { return def; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// ---------------------------------------------------------------- panel (tabs + list)
function buildPanel() {
  const video = document.getElementById("liveVideoBox");
  if (!video) return;
  const wrap = document.createElement("div");
  wrap.className = "rd-panel";
  wrap.innerHTML = `
    <div class="rd-panel-hd">
      <div class="rd-title">الاكتشافات <span id="rdCount"></span></div>
      <button type="button" class="rd-sound" id="rdSound"></button>
    </div>
    <div class="rd-tabs" id="rdTabs"></div>
    <div class="rd-list"></div>`;
  video.insertAdjacentElement("afterend", wrap);
  listEl = wrap.querySelector(".rd-list");
  countEl = wrap.querySelector("#rdCount");
  tabsEl = wrap.querySelector("#rdTabs");
  const sb = wrap.querySelector("#rdSound");
  const paintSound = () => { sb.textContent = soundOn ? "🔔 الصوت مفعّل" : "🔕 الصوت مغلق"; sb.classList.toggle("off", !soundOn); };
  sb.onclick = () => { soundOn = !soundOn; writePref("rasidSound", soundOn ? "1" : "0"); paintSound(); if (soundOn) ping("person"); };
  paintSound();
}

function renderTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = "";
  if (missions.length <= 1 && !liveMission) { tabsEl.style.display = "none"; return; }
  tabsEl.style.display = "flex";
  [...missions].reverse().forEach((m) => {          // newest first
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rd-tab" + (m.id === selectedMission ? " active" : "");
    const live = m.id === liveMission;
    b.innerHTML = `${live ? '<span class="rd-live"></span>' : ""}المهمة ${m.num}
      <small>${live ? "مباشر" : fmtShort(m.start)} · ${m.count}</small>`;
    b.onclick = () => { selectedMission = m.id; userPickedMission = m.id !== liveMission; refresh(); };
    tabsEl.appendChild(b);
  });
}

function renderList() {
  if (!listEl) return;
  const items = currentItems().slice().reverse();     // newest on top, numbers stay
  const m = missions.find((x) => x.id === selectedMission);
  countEl.textContent = m ? `· المهمة ${m.num} (${items.length})` : "(0)";
  listEl.innerHTML = items.length ? "" : `<div class="rd-empty">لا توجد اكتشافات في هذه المهمة بعد</div>`;
  items.forEach((d) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rd-row" + (d.Status === "false_alarm" || d.Status === "duplicate" ? " dim" : "");
    row.dataset.id = d.id;
    row.style.setProperty("--st", d._color);
    row.innerHTML = `
      <span class="rd-num" style="background:${d._color}">${d._num}</span>
      ${d.DetectionImage ? `<img src="${esc(d.DetectionImage)}" alt="">` : `<span class="rd-thumb"></span>`}
      <span class="rd-row-main"><b>${d._icon} ${esc(d._classAr)} · ${pct(d.ConfidenceScore)}</b>
        <small dir="ltr">${fmtCoords(d)}</small></span>
      <span class="rd-row-side"><small>${fmtTime(timeOf(d))}</small>
        <em style="background:${d._color}">${d._statusAr}</em></span>`;
    row.onclick = () => { highlight(d.id, false); if (window.RasidMap) window.RasidMap.focus(d.id, { quiet: true }); open(d.id); };
    listEl.appendChild(row);
  });
  if (highlighted) highlight(highlighted, false);
}

function highlight(id, scroll) {
  highlighted = id;
  if (!listEl) return;
  listEl.querySelectorAll(".rd-row").forEach((r) => r.classList.toggle("sel", r.dataset.id === id));
  const row = id && listEl.querySelector(`.rd-row[data-id="${id}"]`);
  if (row && scroll) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------------------------------------------------------------- notification + sound
let audioCtx = null;
function ping(cls) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const notes = cls === "person" ? [988, 1319] : [784];        // people: double ping, vehicles: single
    notes.forEach((f, i) => {
      const t = audioCtx.currentTime + i * 0.16;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.4);
    });
  } catch (e) { /* sound is optional */ }
}
// browsers only allow sound after the user clicked somewhere on the page once
["click", "keydown"].forEach((ev) => document.addEventListener(ev, () => {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {}
}, { once: true }));

function notify(d) {
  if (!d) return;
  decorate(d);
  ping(d.Class);
  const st = stack();
  while (st.children.length >= 3) st.firstChild.remove();       // never more than 3 on screen
  const el = document.createElement("div");
  el.className = "rd-toast";
  el.style.borderRightColor = d._color;
  const mission = missions.find((m) => m.id === d._mission);
  el.innerHTML = `
    <div class="rd-toast-hd"><span class="rd-num" style="background:${d._color}">${d._num}</span>
      ${d._icon} تم رصد ${esc(d._classAr)} <small>· المهمة ${mission ? mission.num : ""}</small></div>
    <div class="rd-toast-row">الوقت: <b>${fmtTime(timeOf(d))}</b> · الثقة: <b>${pct(d.ConfidenceScore)}</b></div>
    <div class="rd-toast-row">الإحداثيات: <b dir="ltr">${fmtCoords(d)}</b></div>
    <div class="rd-toast-btns">
      <button class="rd-btn rd-primary">عرض والتحقق</button>
      <button class="rd-btn rd-ghost">إغلاق</button>
    </div>`;
  el.querySelector(".rd-primary").onclick = () => {
    el.remove();
    if (d._mission !== selectedMission) { selectedMission = d._mission; refresh(); }
    highlight(d.id, true);
    if (window.RasidMap) window.RasidMap.focus(d.id, { quiet: true });
    open(d.id);
  };
  el.querySelector(".rd-ghost").onclick = () => el.remove();
  st.appendChild(el);
  setTimeout(() => el.remove(), 15000);
}
function stack() {
  let s = document.getElementById("rdToastStack");
  if (!s) { s = document.createElement("div"); s.id = "rdToastStack"; document.body.appendChild(s); }
  return s;
}

// ---------------------------------------------------------------- details window (the ONE place to change status)
function open(id) {
  const d = detections.get(id);
  if (!d) return;
  decorate(d);
  close();
  const mission = missions.find((m) => m.id === d._mission);
  const [x1, y1, x2, y2] = d.BBox || [0, 0, 0, 0];
  const back = document.createElement("div");
  back.className = "rd-back";
  back.innerHTML = `
    <div class="rd-modal" role="dialog" aria-modal="true">
      <div class="rd-modal-hd">
        <h3><span class="rd-num big" style="background:${d._color}">${d._num}</span>
          ${d._icon} ${esc(d._classAr)} <small>· المهمة ${mission ? mission.num : ""}</small></h3>
        <button class="rd-x" aria-label="إغلاق">✕</button>
      </div>
      <div class="rd-img">
        ${d.DetectionImage ? `<img src="${esc(d.DetectionImage)}" alt="صورة الرصد">` : `<div class="rd-noimg">جارٍ رفع الصورة...</div>`}
        <div class="rd-box" style="border-color:${d._color};left:${x1 * 100}%;top:${y1 * 100}%;width:${(x2 - x1) * 100}%;height:${(y2 - y1) * 100}%"></div>
      </div>
      <div class="rd-grid">
        <div><span>نسبة الثقة</span><b>${pct(d.ConfidenceScore)}</b></div>
        <div><span>وقت الرصد</span><b>${fmtTime(timeOf(d))}</b></div>
        <div><span>ارتفاع الدرون</span><b>${esc(d.DroneAltitude)} م</b></div>
        <div><span>الحالة</span><b style="color:${d._color}">${d._statusAr}</b></div>
        <div class="rd-wide"><span>الإحداثيات</span><b dir="ltr">${fmtCoords(d)}</b>
          <a href="https://www.google.com/maps?q=${d.Latitude},${d.Longitude}" target="_blank" rel="noopener">فتح في خرائط Google</a></div>
        <div class="rd-wide rd-note">الموقع هو موقع الدرون لحظة الرصد؛ قد يبعد الهدف عنه تقريباً 10–40 متر.</div>
      </div>
      <div class="rd-status">
        ${!d.Status || d.Status === "new"
          ? `<span class="rd-status-q">هل هذا الرصد صحيح؟</span>`
          : `<span class="rd-status-q">تم التحقق: <b style="color:${d._color}">${d._statusAr}</b> · تغيير إلى:</span>`}
        ${["confirmed", "false_alarm", "duplicate"].filter((s) => s !== d.Status).map((s) => `
          <button class="rd-btn" data-s="${s}" style="background:${STATUS[s].color}">
            ${s === "confirmed" ? "✔ تأكيد" : s === "false_alarm" ? "✖ إنذار خاطئ" : "⧉ مكرر"}</button>`).join("")}
        ${d.Status && d.Status !== "new" ? `<button class="rd-btn rd-ghost" data-s="new">↺ إعادة إلى "بحاجة لتحقق"</button>` : ""}
      </div>
    </div>`;
  back.onclick = (e) => { if (e.target === back) close(); };
  back.querySelector(".rd-x").onclick = close;
  back.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => setStatus(d.id, b.dataset.s)));
  document.body.appendChild(back);
}
function close() { document.querySelectorAll(".rd-back").forEach((e) => e.remove()); }

async function setStatus(id, status) {
  const label = (STATUS[status] || STATUS.new).ar;
  if (!confirm(`تغيير حالة الرصد إلى "${label}"؟`)) return;
  try {
    await updateDoc(doc(db, "Detection", id), {
      Status: status, StatusBy: auth.currentUser ? auth.currentUser.uid : null, StatusAt: serverTimestamp(),
    });
    close();                    // list, map pin and video update by themselves (live listener)
  } catch (e) {
    console.error(e);
    alert("تعذّر تحديث الحالة. تأكد من تسجيل الدخول وصلاحيات قاعدة البيانات.");
  }
}

window.RasidDetections = {
  open, list: currentItems, status: STATUS,
  numberOf: (id) => { const d = detections.get(id); return d ? d._num : null; },
  colorOf: (id) => { const d = detections.get(id); return d ? (STATUS[d.Status] || STATUS.new).color : null; },
};

// ---------------------------------------------------------------- styles
function injectStyles() {
  const css = `
  #rdToastStack{position:fixed;left:18px;bottom:18px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:340px}
  .rd-toast{background:#fffaf3;border:1.5px solid #e7d6c1;border-right:6px solid #dc2626;border-radius:16px;padding:12px 14px;
    box-shadow:0 10px 30px rgba(60,40,20,.18);font-family:Tajawal,sans-serif;color:#3b2f24;animation:rdIn .25s ease}
  @keyframes rdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .rd-toast-hd{font-weight:900;margin-bottom:6px;display:flex;align-items:center;gap:8px}
  .rd-toast-hd small,.rd-modal-hd small{font-weight:700;color:#8a7560}
  .rd-toast-row{font-size:.86rem;margin:2px 0}
  .rd-num{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;
    color:#fff;font-weight:900;font-size:.8rem;flex:none}
  .rd-num.big{min-width:30px;height:30px;font-size:.95rem}
  .rd-toast-btns,.rd-status{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
  .rd-status-q{flex-basis:100%;font-weight:800;font-size:.9rem;color:#5b4632}  .rd-btn{border:none;border-radius:999px;padding:.45rem .9rem;font-family:inherit;font-weight:800;font-size:.85rem;color:#fff;cursor:pointer}
  .rd-btn.current{outline:3px solid rgba(0,0,0,.25);outline-offset:2px}
  .rd-primary{background:#8B6B47}.rd-ghost{background:transparent;color:#8B6B47;border:1.5px solid #d8c3a8}
  .rd-back{position:fixed;inset:0;background:rgba(30,22,14,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}
  .rd-modal{background:#fffaf3;border-radius:22px;max-width:720px;width:100%;max-height:92vh;overflow:auto;padding:18px;font-family:Tajawal,sans-serif;color:#3b2f24}
  .rd-modal-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .rd-modal-hd h3{margin:0;display:flex;align-items:center;gap:8px}
  .rd-x{border:none;background:#f1e6d8;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:1rem}
  .rd-img{position:relative;border-radius:14px;overflow:hidden;background:#1d1a16;direction:ltr}
  .rd-img img{display:block;width:100%}.rd-noimg{color:#f5efe6;padding:3rem;text-align:center}
  .rd-box{position:absolute;border:3px solid #dc2626;box-shadow:0 0 0 2px rgba(255,255,255,.6)}
  .rd-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  .rd-grid>div{background:#f6ede1;border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
  .rd-grid span{font-size:.78rem;color:#8a7560}.rd-grid a{font-size:.85rem;color:#8B6B47;font-weight:800}
  .rd-wide{grid-column:1/-1}.rd-note{font-size:.82rem;color:#7a6550;background:#fff3df !important}
  .rd-panel{margin-top:14px}
  .rd-panel-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .rd-title{font-weight:900;color:#3b2f24}
  .rd-sound{border:1.5px solid #d8c3a8;background:#fffaf3;border-radius:999px;padding:.3rem .8rem;font-family:inherit;font-weight:800;
    font-size:.8rem;color:#8B6B47;cursor:pointer}.rd-sound.off{color:#9ca3af}
  .rd-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .rd-tab{display:flex;align-items:center;gap:6px;border:1.5px solid #e2cfb7;background:#fffaf3;border-radius:999px;padding:.35rem .9rem;
    font-family:inherit;font-weight:800;font-size:.85rem;color:#5b4632;cursor:pointer}
  .rd-tab small{font-weight:700;color:#8a7560}
  .rd-tab.active{background:#8B6B47;border-color:#8B6B47;color:#fff}.rd-tab.active small{color:#f3e5d3}
  .rd-live{width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.25);animation:rdBlink 1.2s infinite}
  @keyframes rdBlink{50%{opacity:.3}}
  .rd-list{display:flex;flex-direction:column;gap:8px;max-height:330px;overflow:auto;padding:2px}
  .rd-empty{color:#8a7560;font-weight:700;padding:.6rem}
  .rd-row{display:flex;align-items:center;gap:10px;width:100%;text-align:right;background:#f6ede1;border:1.5px solid #ead9c4;
    border-right:5px solid var(--st);border-radius:14px;padding:8px;cursor:pointer;font-family:inherit;color:#3b2f24;transition:box-shadow .2s}
  .rd-row:hover{border-color:#c9a77f;border-right-color:var(--st)}
  .rd-row.sel{box-shadow:0 0 0 3px rgba(139,107,71,.45);background:#fff6ea}
  .rd-row.dim{opacity:.6}
  .rd-row img,.rd-thumb{width:64px;height:40px;object-fit:cover;border-radius:8px;background:#1d1a16;flex:none}
  .rd-row-main{flex:1;display:flex;flex-direction:column}.rd-row-main small{color:#7a6550}
  .rd-row-side{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
  .rd-row-side em{font-style:normal;color:#fff;font-size:.75rem;font-weight:800;padding:2px 8px;border-radius:999px}
  @media (max-width:600px){.rd-grid{grid-template-columns:1fr}#rdToastStack{left:10px;right:10px;max-width:none}}`;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
}