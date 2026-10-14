// ============================================================
//  RASID – Live drone stream (RealTimeReportDetails.html)
// ------------------------------------------------------------
//  Connects to the ground station (ground_station/server.py) over a
//  WebSocket and shows the drone video with the model's boxes drawn on top.
//
//  - Shows the stream ONLY if the mission belongs to this report (?docId=...)
//  - Shows "no drone available" when the server is off or no mission runs
//  - Reconnects automatically (leave the page and come back = it reconnects)
//  - Team leader only: a "start / end drone mission" button in the card header
//    (calls the ground station's /mission/start and /mission/stop)
//  - Sends every telemetry update as a browser event, so the map can use it:
//        window.addEventListener('rasid:telemetry', e => e.detail ...)
// ============================================================

(function () {
  // Where the ground station runs. Change this ONE line when the server moves.
  const STREAM_URL = window.RASID_STREAM_URL || 'ws://localhost:8000/ws/stream';

  const LABELS = { person: 'شخص', car: 'سيارة', moto: 'دراجة نارية' };
  const COLORS = { person: '#ef4444', car: '#3b82f6', moto: '#f59e0b' };

  const API_URL = STREAM_URL.replace(/^ws/, 'http').replace(/\/ws\/stream$/, '');

  const reportDocId = new URLSearchParams(window.location.search).get('docId');
  let box, canvas, ctx, overlay, ws, retryMs = 1000, lastFrameAt = 0;
  let btn, connected = false, missionState = 'idle', missionReport = null, busy = false;

  function setup() {
    box = document.getElementById('liveVideoBox');
    if (!box) return;
    box.innerHTML = '';
    box.style.position = 'relative';
    box.style.height = 'auto';
    box.style.minHeight = '320px';
    box.style.padding = '0';
    box.style.overflow = 'hidden';
    box.style.background = '#1d1a16';

    canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    canvas.style.cssText = 'width:100%;height:auto;display:none;border-radius:20px;';
    canvas.dir = 'ltr';            // the page is RTL; drawing coordinates must stay left-to-right
    ctx = canvas.getContext('2d');

    overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'color:#f5efe6;font-weight:800;text-align:center;padding:1rem;line-height:1.9;';

    box.appendChild(canvas);
    box.appendChild(overlay);
    showMessage('جارٍ الاتصال بمحطة الدرون...');
    setupLeaderButton();
    connect();
    setInterval(checkAlive, 2000);
  }

  function showMessage(text) {
    overlay.innerHTML = text;
    overlay.style.display = 'flex';
    canvas.style.display = 'none';
  }

  function showVideo() {
    overlay.style.display = 'none';
    canvas.style.display = 'block';
  }

  function connect() {
    try { ws = new WebSocket(STREAM_URL); } catch (e) { return retry(); }
    ws.onopen = () => { retryMs = 1000; connected = true; updateButton(); };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'status') return onStatus(msg);
      if (msg.type === 'frame') return onFrame(msg);
    };
    ws.onclose = () => {
      connected = false; updateButton();
      showMessage('لا يوجد درون متصل حالياً<br><small>سيتم إعادة الاتصال تلقائياً</small>');
      retry();
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }

  function retry() {
    setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 10000);
  }

  function belongsHere(msg) {
    // No docId in the URL (e.g. opened directly for testing) = show any mission
    return !reportDocId || msg.reportId === reportDocId;
  }

  function onStatus(msg) {
    missionState = msg.state; missionReport = msg.reportId || null; updateButton();
    if (msg.state === 'running' && belongsHere(msg)) return;   // frames will follow
    if (msg.state === 'starting' && belongsHere(msg)) return showMessage('جارٍ تشغيل الدرون...');
    if (msg.state === 'ended' && belongsHere(msg)) return showMessage('انتهت مهمة الدرون');
    showMessage('لا يوجد درون نشط لهذا البلاغ حالياً');
  }

  function onFrame(msg) {
    if (!belongsHere(msg)) return showMessage('لا يوجد درون نشط لهذا البلاغ حالياً');
    lastFrameAt = Date.now();
    const img = new Image();
    img.onload = () => {
      if (canvas.width !== img.width) { canvas.width = img.width; canvas.height = img.height; }
      ctx.drawImage(img, 0, 0);
      ctx.direction = 'ltr'; ctx.textAlign = 'left';
      drawBoxes(msg.boxes);
      drawInfo(msg);
      showVideo();
    };
    img.src = msg.image;

    const src = document.getElementById('videoSource');
    if (src) src.textContent = msg.source;

    window.dispatchEvent(new CustomEvent('rasid:telemetry',
      { detail: { reportId: msg.reportId, missionId: msg.missionId, ...msg.telemetry } }));
  }

  function drawBoxes(boxes) {
    const w = canvas.width, h = canvas.height, lw = Math.max(2, w / 500);
    ctx.font = `bold ${Math.round(w / 55)}px Tajawal, sans-serif`;
    (boxes || []).forEach(b => {
      const [x1, y1, x2, y2] = [b.box[0] * w, b.box[1] * h, b.box[2] * w, b.box[3] * h];
      const color = COLORS[b.cls] || '#ffffff';
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      const label = `${Math.round(b.conf * 100)}% ${LABELS[b.cls] || b.cls}`;
      const tw = ctx.measureText(label).width + 10, th = w / 45;
      const ty = Math.max(0, y1 - th - 2);
      ctx.fillStyle = color; ctx.fillRect(x1, ty, tw, th);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
      ctx.fillText(label, x1 + 5, ty + 2);
    });
  }

  function drawInfo(msg) {
    const t = msg.telemetry, w = canvas.width;
    const people = (msg.boxes || []).filter(b => b.cls === 'person').length;
    const lines = [
      `GPS ${t.lat.toFixed(6)}, ${t.lng.toFixed(6)}   ALT ${t.alt} m   HDG ${Math.round(t.yaw)}°`,
      `People: ${people}   Model: ${msg.stats.modelMs} ms   FPS: ${msg.stats.fps}`
    ];
    ctx.font = `bold ${Math.round(w / 70)}px monospace`;
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      const y = 12 + i * (w / 55);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(10, y - 2, ctx.measureText(line).width + 12, w / 60);
      ctx.fillStyle = '#fff';
      ctx.fillText(line, 16, y);
    });
  }

  // ---------------------------------------------------------- leader button
  function setupLeaderButton() {
    const header = box.parentElement && box.parentElement.querySelector('.cardHd');
    if (!header || !reportDocId) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display:none;margin-inline-start:.6rem;padding:.45rem 1rem;border:none;border-radius:999px;' +
      'font-family:inherit;font-weight:800;font-size:.85rem;cursor:pointer;color:#fff;transition:opacity .2s;';
    btn.addEventListener('click', onButtonClick);
    header.appendChild(btn);
    // The page decides who the leader is (window._isLeader is set after Firestore loads)
    let tries = 0;
    const wait = setInterval(() => {
      tries++;
      if (window._isLeader === true && !window._reportAlreadyClosed) {
        btn.style.display = 'inline-block'; updateButton(); clearInterval(wait);
      } else if (window._isLeader === false || tries > 40) {
        clearInterval(wait);
      }
    }, 500);
  }

  function updateButton() {
    if (!btn) return;
    const mine = missionReport === reportDocId;
    let text, color, enabled = !busy;
    if (!connected) { text = 'محطة الرصد غير متصلة'; color = '#9ca3af'; enabled = false; }
    else if ((missionState === 'running' || missionState === 'starting') && mine) { text = 'إنهاء مهمة الدرون'; color = '#b91c1c'; }
    else if (missionState === 'running' || missionState === 'starting') { text = 'الدرون مشغول ببلاغ آخر'; color = '#9ca3af'; enabled = false; }
    else { text = 'بدء مهمة الدرون'; color = '#8B6B47'; }
    btn.textContent = busy ? '...' : text;
    btn.style.background = color;
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '.7';
    btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  async function onButtonClick() {
    const running = (missionState === 'running' || missionState === 'starting') && missionReport === reportDocId;
    const question = running ? 'هل تريد إنهاء مهمة الدرون لهذا البلاغ؟' : 'هل تريد بدء مهمة الدرون لهذا البلاغ؟';
    if (!confirm(question)) return;                       // error prevention (same UX rule as the rest of Rasid)
    busy = true; updateButton();
    try {
      const res = await fetch(API_URL + (running ? '/mission/stop' : '/mission/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: running ? '{}' : JSON.stringify({ reportId: reportDocId })
      });
      if (!res.ok) throw new Error(res.status);
    } catch (e) {
      alert('تعذّر الاتصال بمحطة الرصد. تأكد أن محطة الدرون تعمل.');
    }
    busy = false; updateButton();
  }

  function checkAlive() {
    // connected, but no frame for 5 s = the stream stopped
    if (canvas.style.display === 'block' && Date.now() - lastFrameAt > 5000) {
      showMessage('انقطع بث الدرون<br><small>بانتظار عودة البث...</small>');
    }
  }

  document.addEventListener('DOMContentLoaded', setup);
})();