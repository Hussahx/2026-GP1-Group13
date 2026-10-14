// ============================================================
//  RASID – Detection alerts (user story 33)
// ------------------------------------------------------------
//  Listens to Firestore "Detection" documents of THIS report (?docId=...).
//  The ground station writes them (one document per person found).
//
//  - New detection while the page is open -> notification (time, coordinates,
//    type, confidence) with a "View details" button
//  - Details: captured image with the box, coordinates, Google Maps link,
//    and buttons for the volunteer to set the status:
//    confirmed / false alarm / duplicate
//  - A list of all detections of this report under the drone video
//  - Shares the list with the map:   window.addEventListener('rasid:detections', e => e.detail)
//    and lets the map open a detection:  window.RasidDetections.open(id)
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

const STATUS = {
  new:         { ar: "جديد",        color: "#b45309" },
  confirmed:   { ar: "مؤكَّد",       color: "#15803d" },
  false_alarm: { ar: "إنذار خاطئ",   color: "#6b7280" },
  duplicate:   { ar: "مكرر",         color: "#6b7280" },
};

const docId = new URLSearchParams(location.search).get("docId");
const detections = new Map();          // id -> data
let firstSnapshot = true;
let listEl, countEl;

injectStyles();
if (docId) start();

function start() {
  buildList();
  const q = query(collection(db, "Detection"), where("ReportID", "==", docId));
  onSnapshot(q, (snap) => {
    snap.docChanges().forEach((ch) => {
      const d = { id: ch.doc.id, ...ch.doc.data() };
      if (ch.type === "removed") { detections.delete(d.id); return; }
      detections.set(d.id, d);
      if (ch.type === "added" && !firstSnapshot) notify(d);
    });
    firstSnapshot = false;
    renderList();
    window.dispatchEvent(new CustomEvent("rasid:detections", { detail: sorted() }));
  }, (err) => {
    console.error("[RASID] Detection listener error:", err);
    if (countEl) countEl.textContent = "تعذّر تحميل الاكتشافات (صلاحيات قاعدة البيانات)";
  });
}

// ---------------------------------------------------------------- helpers
function sorted() {
  return [...detections.values()].sort((a, b) => (b.FrameTime || "").localeCompare(a.FrameTime || ""));
}
function fmtTime(d) {
  const t = d.TimeStamp && d.TimeStamp.toDate ? d.TimeStamp.toDate() : new Date();
  return t.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtCoords(d) { return `${Number(d.Latitude).toFixed(6)}, ${Number(d.Longitude).toFixed(6)}`; }
function pct(v) { return Math.round((v || 0) * 100) + "%"; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---------------------------------------------------------------- notification
function notify(d) {
  const el = document.createElement("div");
  el.className = "rd-toast";
  el.innerHTML = `
    <div class="rd-toast-hd"><span class="rd-dot"></span> تم رصد ${esc(d.ClassAr || "شخص")} جديد</div>
    <div class="rd-toast-row">الوقت: <b>${fmtTime(d)}</b></div>
    <div class="rd-toast-row">الإحداثيات: <b dir="ltr">${fmtCoords(d)}</b></div>
    <div class="rd-toast-row">نسبة الثقة: <b>${pct(d.ConfidenceScore)}</b> · الحالة: <b>${STATUS[d.Status]?.ar || "جديد"}</b></div>
    <div class="rd-toast-btns">
      <button class="rd-btn rd-primary">عرض التفاصيل</button>
      <button class="rd-btn rd-ghost">إغلاق</button>
    </div>`;
  el.querySelector(".rd-primary").onclick = () => { open(d.id); el.remove(); };
  el.querySelector(".rd-ghost").onclick = () => el.remove();
  stack().appendChild(el);
  setTimeout(() => el.remove(), 15000);
}
function stack() {
  let s = document.getElementById("rdToastStack");
  if (!s) { s = document.createElement("div"); s.id = "rdToastStack"; document.body.appendChild(s); }
  return s;
}

// ---------------------------------------------------------------- details modal
function open(id) {
  const d = detections.get(id);
  if (!d) return;
  close();
  const [x1, y1, x2, y2] = d.BBox || [0, 0, 0, 0];
  const back = document.createElement("div");
  back.className = "rd-back";
  back.innerHTML = `
    <div class="rd-modal" role="dialog" aria-modal="true">
      <div class="rd-modal-hd">
        <h3>تفاصيل الرصد</h3>
        <button class="rd-x" aria-label="إغلاق">✕</button>
      </div>
      <div class="rd-img">
        ${d.DetectionImage ? `<img src="${esc(d.DetectionImage)}" alt="صورة الرصد">` : `<div class="rd-noimg">جارٍ رفع الصورة...</div>`}
        <div class="rd-box" style="left:${x1 * 100}%;top:${y1 * 100}%;width:${(x2 - x1) * 100}%;height:${(y2 - y1) * 100}%"></div>
      </div>
      <div class="rd-grid">
        <div><span>النوع</span><b>${esc(d.ClassAr || d.Class)}</b></div>
        <div><span>نسبة الثقة</span><b>${pct(d.ConfidenceScore)}</b></div>
        <div><span>وقت الرصد</span><b>${fmtTime(d)}</b></div>
        <div><span>ارتفاع الدرون</span><b>${esc(d.DroneAltitude)} م</b></div>
        <div class="rd-wide"><span>الإحداثيات</span><b dir="ltr">${fmtCoords(d)}</b>
          <a href="https://www.google.com/maps?q=${d.Latitude},${d.Longitude}" target="_blank" rel="noopener">فتح في خرائط Google</a></div>
        <div class="rd-wide rd-note">الموقع هو موقع الدرون لحظة الرصد؛ قد يبعد الشخص عنه تقريباً 10–40 متر.</div>
        <div class="rd-wide"><span>الحالة الحالية</span><b style="color:${STATUS[d.Status]?.color || "#b45309"}">${STATUS[d.Status]?.ar || "جديد"}</b></div>
      </div>
      <div class="rd-status">
        <button class="rd-btn" data-s="confirmed" style="background:#15803d">تأكيد: شخص حقيقي</button>
        <button class="rd-btn" data-s="false_alarm" style="background:#6b7280">إنذار خاطئ</button>
        <button class="rd-btn" data-s="duplicate" style="background:#9ca3af">مكرر</button>
      </div>
    </div>`;
  back.onclick = (e) => { if (e.target === back) close(); };
  back.querySelector(".rd-x").onclick = close;
  back.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => setStatus(d.id, b.dataset.s)));
  document.body.appendChild(back);
}
function close() { document.querySelectorAll(".rd-back").forEach((e) => e.remove()); }

async function setStatus(id, status) {
  if (!confirm(`تغيير حالة الرصد إلى "${STATUS[status].ar}"؟`)) return;
  try {
    await updateDoc(doc(db, "Detection", id), {
      Status: status, StatusBy: auth.currentUser ? auth.currentUser.uid : null, StatusAt: serverTimestamp(),
    });
    close();
  } catch (e) {
    console.error(e);
    alert("تعذّر تحديث الحالة. تأكد من تسجيل الدخول وصلاحيات قاعدة البيانات.");
  }
}

// ---------------------------------------------------------------- list under the video
function buildList() {
  const video = document.getElementById("liveVideoBox");
  if (!video) return;
  const wrap = document.createElement("div");
  wrap.className = "rd-list-wrap";
  wrap.innerHTML = `<div class="rd-list-hd">الاكتشافات <span id="rdCount">(0)</span></div><div class="rd-list"></div>`;
  video.insertAdjacentElement("afterend", wrap);
  listEl = wrap.querySelector(".rd-list");
  countEl = wrap.querySelector("#rdCount");
}
function renderList() {
  if (!listEl) return;
  const items = sorted();
  countEl.textContent = `(${items.length})`;
  listEl.innerHTML = items.length ? "" : `<div class="rd-empty">لا توجد اكتشافات لهذا البلاغ بعد</div>`;
  items.forEach((d) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rd-row";
    row.innerHTML = `
      ${d.DetectionImage ? `<img src="${esc(d.DetectionImage)}" alt="">` : `<span class="rd-thumb"></span>`}
      <span class="rd-row-main"><b>${esc(d.ClassAr || d.Class)} · ${pct(d.ConfidenceScore)}</b>
        <small dir="ltr">${fmtCoords(d)}</small></span>
      <span class="rd-row-side"><small>${fmtTime(d)}</small>
        <em style="background:${STATUS[d.Status]?.color || "#b45309"}">${STATUS[d.Status]?.ar || "جديد"}</em></span>`;
    row.onclick = () => open(d.id);
    listEl.appendChild(row);
  });
}

window.RasidDetections = { open, list: sorted };

// ---------------------------------------------------------------- styles
function injectStyles() {
  const css = `
  #rdToastStack{position:fixed;left:18px;bottom:18px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:340px}
  .rd-toast{background:#fffaf3;border:1.5px solid #e7d6c1;border-right:6px solid #ef4444;border-radius:16px;padding:12px 14px;
    box-shadow:0 10px 30px rgba(60,40,20,.18);font-family:Tajawal,sans-serif;color:#3b2f24;animation:rdIn .25s ease}
  @keyframes rdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .rd-toast-hd{font-weight:900;margin-bottom:6px;display:flex;align-items:center;gap:8px}
  .rd-dot{width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.2)}
  .rd-toast-row{font-size:.88rem;margin:2px 0}
  .rd-toast-btns,.rd-status{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .rd-btn{border:none;border-radius:999px;padding:.45rem .9rem;font-family:inherit;font-weight:800;font-size:.85rem;color:#fff;cursor:pointer}
  .rd-primary{background:#8B6B47}.rd-ghost{background:transparent;color:#8B6B47;border:1.5px solid #d8c3a8}
  .rd-back{position:fixed;inset:0;background:rgba(30,22,14,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}
  .rd-modal{background:#fffaf3;border-radius:22px;max-width:720px;width:100%;max-height:92vh;overflow:auto;padding:18px;font-family:Tajawal,sans-serif;color:#3b2f24}
  .rd-modal-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.rd-modal-hd h3{margin:0}
  .rd-x{border:none;background:#f1e6d8;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:1rem}
  .rd-img{position:relative;border-radius:14px;overflow:hidden;background:#1d1a16;direction:ltr}
  .rd-img img{display:block;width:100%}.rd-noimg{color:#f5efe6;padding:3rem;text-align:center}
  .rd-box{position:absolute;border:3px solid #ef4444;box-shadow:0 0 0 2px rgba(255,255,255,.6)}
  .rd-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  .rd-grid>div{background:#f6ede1;border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
  .rd-grid span{font-size:.78rem;color:#8a7560}.rd-grid a{font-size:.85rem;color:#8B6B47;font-weight:800}
  .rd-wide{grid-column:1/-1}.rd-note{font-size:.82rem;color:#7a6550;background:#fff3df !important}
  .rd-list-wrap{margin-top:14px}.rd-list-hd{font-weight:900;margin-bottom:8px;color:#3b2f24}
  .rd-list{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto}
  .rd-empty{color:#8a7560;font-weight:700;padding:.6rem}
  .rd-row{display:flex;align-items:center;gap:10px;width:100%;text-align:right;background:#f6ede1;border:1.5px solid #ead9c4;
    border-radius:14px;padding:8px;cursor:pointer;font-family:inherit;color:#3b2f24}
  .rd-row:hover{border-color:#c9a77f}
  .rd-row img,.rd-thumb{width:64px;height:40px;object-fit:cover;border-radius:8px;background:#1d1a16;flex:none}
  .rd-row-main{flex:1;display:flex;flex-direction:column}.rd-row-main small{color:#7a6550}
  .rd-row-side{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
  .rd-row-side em{font-style:normal;color:#fff;font-size:.75rem;font-weight:800;padding:2px 8px;border-radius:999px}
  @media (max-width:600px){.rd-grid{grid-template-columns:1fr}#rdToastStack{left:10px;right:10px;max-width:none}}`;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
}