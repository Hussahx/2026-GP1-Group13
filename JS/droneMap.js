// ============================================================
//  RASID – Drone tracking map (RealTimeReportDetails.html)
// ------------------------------------------------------------
//  - Blue arrow  = live drone position (from droneStream.js -> 'rasid:telemetry')
//  - Blue dashed = the path the drone flew during this session
//  - Red pins    = detections of THIS report (from detectionAlerts.js -> 'rasid:detections')
//                  click a pin -> small card with the details
//                  "عرض التفاصيل الكاملة" -> the full detection modal (status buttons)
//  - The map follows the drone; dragging the map stops following,
//    and the "تتبع الدرون" button turns it back on.
//
//  TWO MAP ENGINES, same behaviour:
//    * Google Maps  – used when GOOGLE_MAPS_API_KEY below is filled in
//    * Leaflet + Esri satellite (free, no key) – used until then
//  To switch to Google later: paste the key below. Nothing else changes.
// ============================================================

const GOOGLE_MAPS_API_KEY = window.RASID_MAPS_KEY || "PUT_YOUR_GOOGLE_MAPS_KEY_HERE";

const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 }; // Riyadh – used until we get any GPS point
const MIN_PATH_STEP_M = 2;                          // add a path point only after the drone moved 2 m
const MAX_PATH_POINTS = 5000;

const STATUS = {
  new:         { ar: "جديد",       color: "#ef4444" },
  confirmed:   { ar: "مؤكَّد",      color: "#dc2626" },
  false_alarm: { ar: "إنذار خاطئ",  color: "#9ca3af" },
  duplicate:   { ar: "مكرر",        color: "#9ca3af" },
};

let engine = null;                  // the map engine in use (google or leaflet), see below
let hasDrone = false, lastDrone = null;
let following = true, lastPanAt = 0, fittedToDetections = false;
const pins = new Map();             // detection id -> { marker, data }
let pendingDetections = null;       // list that arrived before the map was ready

const mapEl = document.getElementById("googleMap");

// Listen right away (events may come before the map finishes loading)
window.addEventListener("rasid:detections", (e) => {
  if (engine) syncDetections(e.detail || []);
  else pendingDetections = e.detail || [];
});
window.addEventListener("rasid:telemetry", (e) => { if (engine) onTelemetry(e.detail); });

if (mapEl) start();

// ---------------------------------------------------------------- start
async function start() {
  const hasGoogleKey = GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.startsWith("PUT_");
  try {
    engine = hasGoogleKey ? await googleEngine() : await leafletEngine();
  } catch (err) {
    console.error("[RASID] map failed:", err);
    return showMapMessage("تعذّر تحميل الخريطة", "تحقق من الاتصال بالإنترنت");
  }
  engine.onUserDrag(() => setFollowing(false));
  engine.addFollowButton(buildFollowButton());

  const initial = pendingDetections || (window.RasidDetections && window.RasidDetections.list()) || [];
  syncDetections(initial);
  pendingDetections = null;
  console.log("[RASID] map engine:", engine.name);
}

// ---------------------------------------------------------------- drone
function onTelemetry(t) {
  if (!t || typeof t.lat !== "number" || typeof t.lng !== "number") return;
  const pos = { lat: t.lat, lng: t.lng };

  if (!hasDrone) {
    hasDrone = true;
    engine.createDrone(pos, droneElement());
    engine.setView(pos, 18);
  } else {
    engine.moveDrone(pos);
  }
  const arrow = mapEl.querySelector(".rm-drone-arrow");
  if (arrow && typeof t.yaw === "number") arrow.style.transform = `rotate(${t.yaw}deg)`;

  if (!lastDrone || metres(lastDrone.lat, lastDrone.lng, pos.lat, pos.lng) >= MIN_PATH_STEP_M) {
    engine.pathPush(pos);
    lastDrone = pos;
  }

  // follow the drone (at most once a second, so the map doesn't shake)
  if (following && Date.now() - lastPanAt > 1000) {
    lastPanAt = Date.now();
    engine.panTo(pos);
  }
}

function droneElement() {
  const el = document.createElement("div");
  el.className = "rm-drone";
  el.innerHTML = `<span class="rm-drone-pulse"></span>
    <svg viewBox="0 0 24 24" width="30" height="30" class="rm-drone-arrow">
      <circle cx="12" cy="12" r="11" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
      <path d="M12 5 L17 17 L12 14 L7 17 Z" fill="#fff"/>
    </svg>`;
  return el;
}

function buildFollowButton() {
  const b = document.createElement("button");
  b.type = "button";
  b.id = "rmFollowBtn";
  b.className = "rm-follow";
  b.textContent = "تتبع الدرون";
  b.style.display = "none";
  b.onclick = (e) => {
    e.stopPropagation();
    setFollowing(true);
    if (lastDrone) engine.panTo(lastDrone);
  };
  return b;
}
function setFollowing(on) {
  following = on;
  const b = document.getElementById("rmFollowBtn");
  if (b) b.style.display = on || !hasDrone ? "none" : "block";
}

// ---------------------------------------------------------------- detections
function syncDetections(list) {
  const seen = new Set();
  list.forEach((d) => {
    if (typeof d.Latitude !== "number" || typeof d.Longitude !== "number") return;
    seen.add(d.id);
    const pos = { lat: d.Latitude, lng: d.Longitude };
    const existing = pins.get(d.id);
    if (existing) {
      existing.data = d;
      engine.updatePin(existing.marker, pos, pinElement(d, false));
    } else {
      const marker = engine.createPin(pos, pinElement(d, fittedToDetections),   // drop animation for new ones
        `${d.ClassAr || "شخص"} · ${pct(d.ConfidenceScore)}`, () => openInfo(d.id));
      pins.set(d.id, { marker, data: d });
    }
  });
  for (const [id, p] of pins) {                     // removed in Firestore -> remove from map
    if (!seen.has(id)) { engine.removePin(p.marker); pins.delete(id); }
  }

  // First time: if the drone isn't flying, zoom to where the detections are
  if (!fittedToDetections) {
    fittedToDetections = true;
    if (!hasDrone && pins.size) {
      const pts = [...pins.values()].map((p) => ({ lat: p.data.Latitude, lng: p.data.Longitude }));
      if (pts.length === 1) engine.setView(pts[0], 18);
      else engine.fit(pts);
    }
  }
}

function pinElement(d, animate) {
  const st = STATUS[d.Status] || STATUS.new;
  const el = document.createElement("div");
  el.className = "rm-pin" + (animate ? " rm-pin-drop" : "") +
                 (d.Status === "false_alarm" || d.Status === "duplicate" ? " rm-pin-dim" : "");
  el.innerHTML = `
    <svg viewBox="0 0 32 42" width="32" height="42">
      <path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z"
            fill="${st.color}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="15.5" r="6" fill="#fff"/>
      ${d.Status === "confirmed" ? '<path d="M12.6 15.6l2.4 2.4 4.4-4.6" stroke="#dc2626" stroke-width="2.2" fill="none" stroke-linecap="round"/>' : ""}
    </svg>`;
  return el;
}

function openInfo(id) {
  const p = pins.get(id);
  if (!p) return;
  const d = p.data;
  const st = STATUS[d.Status] || STATUS.new;
  const box = document.createElement("div");
  box.className = "rm-info";
  box.dir = "rtl";
  box.innerHTML = `
    ${d.DetectionImage
      ? `<img src="${esc(d.DetectionImage)}" alt="صورة الرصد">`
      : `<div class="rm-info-noimg">جارٍ رفع الصورة...</div>`}
    <div class="rm-info-title">${esc(d.ClassAr || "شخص")} · ${pct(d.ConfidenceScore)}
      <span class="rm-info-badge" style="background:${st.color}">${st.ar}</span></div>
    <div class="rm-info-row"><span>وقت الرصد</span><b>${fmtTime(d)}</b></div>
    <div class="rm-info-row"><span>الإحداثيات</span><b dir="ltr">${Number(d.Latitude).toFixed(6)}, ${Number(d.Longitude).toFixed(6)}</b></div>
    <div class="rm-info-row"><span>ارتفاع الدرون</span><b>${esc(d.DroneAltitude ?? "—")} م</b></div>
    <button type="button" class="rm-info-btn">عرض التفاصيل الكاملة</button>`;
  box.querySelector(".rm-info-btn").onclick = () => {
    engine.closeInfo();
    if (window.RasidDetections) window.RasidDetections.open(id);
  };
  engine.openInfo(p.marker, box);
  setFollowing(false);       // keep the map still while the user reads the card
}

// Lets other code (e.g. the list under the video) move the map to a detection
window.RasidMap = {
  focus(id) {
    const p = pins.get(id);
    if (!p || !engine) return;
    engine.setView({ lat: p.data.Latitude, lng: p.data.Longitude }, 18);
    openInfo(id);
    mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
  },
};

// ================================================================ ENGINE: Google Maps
async function googleEngine() {
  window.gm_authFailure = () =>
    showMapMessage("مفتاح Google Maps غير صالح أو الفوترة غير مفعّلة",
      "احذف المفتاح من JS/droneMap.js للعودة للخريطة المجانية مؤقتاً");

  await new Promise((resolve, reject) => {
    if (window.google && google.maps && google.maps.importLibrary) return resolve();
    window.__rasidMapsReady = resolve;
    const s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY) +
            "&v=weekly&language=ar&region=SA&loading=async&callback=__rasidMapsReady";
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { ControlPosition } = await google.maps.importLibrary("core");

  const map = new Map(mapEl, {
    center: DEFAULT_CENTER, zoom: 6,
    mapId: "DEMO_MAP_ID",                // Google's test Map ID (needed for the new markers)
    mapTypeId: "hybrid",                 // satellite + names
    gestureHandling: "cooperative",
    streetViewControl: false,
    mapTypeControlOptions: { position: ControlPosition.LEFT_BOTTOM },
    fullscreenControlOptions: { position: ControlPosition.LEFT_TOP },
  });
  const info = new InfoWindow({ maxWidth: 300 });
  const path = new google.maps.Polyline({
    map, path: [], geodesic: true, strokeOpacity: 0,
    icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: "#60a5fa", scale: 3 },
              offset: "0", repeat: "14px" }],
  });
  let drone = null;

  return {
    name: "google",
    onUserDrag: (fn) => map.addListener("dragstart", fn),
    addFollowButton: (el) => map.controls[ControlPosition.LEFT_TOP].push(el),
    setView: (pos, z) => { map.setCenter(pos); map.setZoom(z); },
    panTo: (pos) => map.panTo(pos),
    fit: (pts) => { const b = new google.maps.LatLngBounds(); pts.forEach((p) => b.extend(p)); map.fitBounds(b, 60); },
    createDrone: (pos, el) => {
      el.classList.add("rm-drone-google");
      drone = new AdvancedMarkerElement({ map, position: pos, content: el, title: "موقع الدرون", zIndex: 1000 });
    },
    moveDrone: (pos) => { drone.position = pos; },
    pathPush: (pos) => {
      const p = path.getPath();
      p.push(new google.maps.LatLng(pos.lat, pos.lng));
      if (p.getLength() > MAX_PATH_POINTS) p.removeAt(0);
    },
    createPin: (pos, el, title, onClick) => {
      const m = new AdvancedMarkerElement({ map, position: pos, content: el, title, gmpClickable: true, zIndex: 500 });
      m.addListener("click", onClick);
      return m;
    },
    updatePin: (m, pos, el) => { m.position = pos; m.content = el; },
    removePin: (m) => { m.map = null; },
    openInfo: (m, el) => { info.setContent(el); info.open({ map, anchor: m }); },
    closeInfo: () => info.close(),
  };
}

// ================================================================ ENGINE: Leaflet (free)
async function leafletEngine() {
  await loadCss("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js");

  mapEl.dir = "ltr";                       // Leaflet needs LTR inside our RTL page
  const map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView(DEFAULT_CENTER, 6);
  // Ctrl + scroll zooms (like Google's "cooperative" mode); normal scroll scrolls the page
  mapEl.addEventListener("wheel", (e) => {
    if (e.ctrlKey) { map.scrollWheelZoom.enable(); e.preventDefault(); }
    else map.scrollWheelZoom.disable();
  }, { passive: false });

  const esriAttr = "Imagery &copy; Esri, Maxar, Earthstar Geographics";
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, maxNativeZoom: 19, attribution: esriAttr });
  const labels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, maxNativeZoom: 19 });
  const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 20, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap contributors" });

  const hybrid = L.layerGroup([satellite, labels]).addTo(map);
  L.control.layers({ "قمر صناعي": hybrid, "خريطة": streets }, null, { position: "bottomleft" }).addTo(map);

  const path = L.polyline([], { color: "#60a5fa", weight: 3, opacity: 0.9, dashArray: "6 8" }).addTo(map);
  let drone = null;

  const icon = (el, w, h, ax, ay) => L.divIcon({ html: el, className: "rm-leaflet-icon",
                                                 iconSize: [w, h], iconAnchor: [ax, ay], popupAnchor: [0, -ay + 2] });

  return {
    name: "leaflet",
    onUserDrag: (fn) => map.on("dragstart", fn),
    addFollowButton: (el) => {
      const C = L.Control.extend({ onAdd: () => { L.DomEvent.disableClickPropagation(el); return el; } });
      new C({ position: "topleft" }).addTo(map);
    },
    setView: (pos, z) => map.setView(pos, z),
    panTo: (pos) => map.panTo(pos),
    fit: (pts) => map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [60, 60] }),
    createDrone: (pos, el) => {
      drone = L.marker(pos, { icon: icon(el, 30, 30, 15, 15), zIndexOffset: 1000, title: "موقع الدرون",
                              interactive: false }).addTo(map);
    },
    moveDrone: (pos) => drone.setLatLng(pos),
    pathPush: (pos) => {
      path.addLatLng(pos);
      const pts = path.getLatLngs();
      if (pts.length > MAX_PATH_POINTS) { pts.shift(); path.setLatLngs(pts); }
    },
    createPin: (pos, el, title, onClick) => {
      const m = L.marker(pos, { icon: icon(el, 32, 42, 16, 42), title, zIndexOffset: 500 }).addTo(map);
      m.on("click", onClick);
      return m;
    },
    updatePin: (m, pos, el) => { m.setLatLng(pos); m.setIcon(icon(el, 32, 42, 16, 42)); },
    removePin: (m) => m.remove(),
    openInfo: (m, el) => {
      m.unbindPopup();
      m.bindPopup(el, { maxWidth: 300, minWidth: 260, className: "rm-popup" }).openPopup();
    },
    closeInfo: () => map.closePopup(),
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("failed: " + src));
    document.head.appendChild(s);
  });
}
function loadCss(href) {
  return new Promise((resolve) => {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.onload = resolve; l.onerror = resolve;
    document.head.appendChild(l);
  });
}

// ---------------------------------------------------------------- helpers
function showMapMessage(title, sub) {
  if (!mapEl) return;
  mapEl.innerHTML = `<div class="rm-msg"><b>${esc(title)}</b><small>${esc(sub || "")}</small></div>`;
}
function metres(lat1, lng1, lat2, lng2) {
  const dy = (lat2 - lat1) * 111320;
  const dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}
function fmtTime(d) {
  const t = d.TimeStamp && d.TimeStamp.toDate ? d.TimeStamp.toDate()
          : d.FrameTime ? new Date(d.FrameTime) : null;
  return t ? t.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "medium" }) : "—";
}
function pct(v) { return Math.round((v || 0) * 100) + "%"; }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------- styles
(function injectStyles() {
  const css = `
  #googleMap{position:absolute;inset:0;z-index:1}
  .mapWrap .mapHeader{z-index:500}
  .rm-msg{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
    text-align:center;padding:1rem;font-family:Tajawal,sans-serif;color:#5b4632}
  .rm-msg b{font-size:1rem;font-weight:900}.rm-msg small{font-size:.85rem;color:#8a7560}
  .rm-leaflet-icon{background:none;border:none}
  .rm-drone{position:relative;width:30px;height:30px}
  .rm-drone-google{transform:translateY(50%)}
  .rm-drone-arrow{position:relative;display:block;transition:transform .4s ease;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))}
  .rm-drone-pulse{position:absolute;inset:-10px;border-radius:50%;background:rgba(59,130,246,.35);animation:rmPulse 1.8s ease-out infinite}
  @keyframes rmPulse{from{transform:scale(.5);opacity:1}to{transform:scale(1.6);opacity:0}}
  .rm-pin{cursor:pointer;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));transition:transform .15s;transform-origin:50% 100%}
  .rm-pin:hover{transform:scale(1.15)}
  .rm-pin-dim{opacity:.6}
  .rm-pin-drop{animation:rmDrop .5s cubic-bezier(.3,1.6,.6,1)}
  @keyframes rmDrop{from{transform:translateY(-40px);opacity:0}to{transform:none;opacity:1}}
  .rm-follow{margin:10px;padding:8px 14px;border:none;border-radius:999px;background:#3b82f6;color:#fff;
    font-family:Tajawal,sans-serif;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .leaflet-control .rm-follow{margin:0}
  .rm-popup .leaflet-popup-content{margin:12px}
  .rm-info{font-family:Tajawal,sans-serif;color:#3b2f24;width:260px}
  .rm-info img{width:100%;border-radius:10px;display:block;margin-bottom:8px;background:#1d1a16}
  .rm-info-noimg{background:#1d1a16;color:#f5efe6;border-radius:10px;padding:1.4rem;text-align:center;margin-bottom:8px;font-size:.85rem}
  .rm-info-title{font-weight:900;font-size:1rem;margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .rm-info-badge{color:#fff;font-size:.72rem;font-weight:800;padding:2px 8px;border-radius:999px}
  .rm-info-row{display:flex;justify-content:space-between;gap:8px;font-size:.84rem;padding:3px 0;border-bottom:1px dashed #eadccb}
  .rm-info-row span{color:#8a7560}
  .rm-info-btn{margin-top:10px;width:100%;padding:8px;border:none;border-radius:999px;background:#8B6B47;color:#fff;
    font-family:inherit;font-weight:800;font-size:.88rem;cursor:pointer}`;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
})();

console.log("[RASID] droneMap.js loaded");