/* rasidCharts.js
   Stats section charts, read from the Firestore "Report" collection:
     • Doughnut  — reports by status
     • Tab 1     — reports in the last 7 days (line)
     • Tab 2     — reports by region (horizontal bars)
   If Firestore can't be read (rules / network) a small "could not load data" note is shown and the console prints the real error.
   Any chart whose <canvas> is missing from the page is skipped (no errors).
   Place in /JS/ and load with <script type="module" src="/JS/rasidCharts.js"></script>
*/
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0',
  authDomain: 'rasid-1bb06.firebaseapp.com',
  projectId: 'rasid-1bb06',
  storageBucket: 'rasid-1bb06.firebasestorage.app',
  messagingSenderId: '668525115587',
  appId: '1:668525115587:web:e017be3b5cbf4ac3b30a76'
};

/* ── Colors (each status keeps one fixed meaning) ───────── */
const C = {
  teal: '#4F8A6B',
  tealDark: '#2F6B50',
  orange: '#D9A441',
  grid: 'rgba(43,33,24,0.08)',
  text: '#2B2118'
};
const STATUS = [
  { key: 'received', label: 'بلاغ مستلم',   color: '#7FA6C9' },
  { key: 'progress', label: 'جارٍ العمل عليها', color: '#E0B25C' },
  { key: 'found',    label: 'تم العثور', color: '#5BA37F' },
  { key: 'notfound', label: 'لم يتم العثور',        color: '#C9806B' },
  { key: 'closed',   label: 'مغلق',                 color: '#A8B0AA' }   // fallback only: closed with no outcome (hidden when 0)
];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// The 13 regions, exactly as they appear in the report form
const REGIONS = ['الرياض', 'مكة المكرمة', 'المدينة المنورة', 'القصيم', 'المنطقة الشرقية', 'عسير', 'تبوك',
                 'حائل', 'الحدود الشمالية', 'جازان', 'نجران', 'الباحة', 'الجوف'];

// true  = merged reports (mergedReports / "Marged") count as ONE report: the main report is counted, the duplicates are not
// false = count every document in the Report collection, merged duplicates included
const EXCLUDE_MERGED = true;

const $ = (id) => document.getElementById(id);
const charts = {};

/* ── Helpers ────────────────────────────────────────────── */
const toDate = (t) => { if (!t) return null; const d = t.toDate ? t.toDate() : new Date(t); return isNaN(d) ? null : d; };

// Report.status values seen in Firestore: "Report Received", "search_in_progress", "rescued", "report_closed"
// A closed report keeps status "rescued" and is told apart by its `outcome`:
//   found_safe / found_injured / found_deceased → found (label: تم العثور)  |  not_found → notfound
function statusKey(d) {
  const s = String(d.Status || d.status || '').trim().toLowerCase();
  const outcome = String(d.outcome || '').trim().toLowerCase();

  if (/^not[_\s-]?found/.test(outcome)) return 'notfound';
  if (/^found/.test(outcome)) return 'found';

  if (/rescued|found|عثور/.test(s)) return 'found';                 // rescued but no outcome recorded
  if (/clos|مغلق|مقفل/.test(s)) return 'closed';                    // closed but no outcome recorded
  if (/progress|جار|متابع|معالج/.test(s)) return 'progress';
  return 'received';                                                // "Report Received" and anything unknown
}

// Report date: LoggedAt (Timestamp) → ReportDate ("5/10/2026" = M/D/YYYY) → earliest statusLog entry
function reportDate(d) {
  const direct = toDate(d.LoggedAt || d.CreatedAt || d.createdAt);
  if (direct) return direct;
  const m = String(d.ReportDate || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const log = Array.isArray(d.statusLog) ? d.statusLog : [];
  const dates = log.map((e) => toDate(e && e.timestamp)).filter(Boolean).sort((x, y) => x - y);
  return dates[0] || null;
}
const dayKey = (dt) => dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();

/* ── Data (everything comes from Firestore) ─────────────── */
async function loadData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - i);
    days.push({ key: dayKey(dt), label: DAYS_AR[dt.getDay()], count: 0 });
  }
  const status = { received: 0, progress: 0, found: 0, notfound: 0, closed: 0 };
  const regions = {};
  let foundCount = 0, volunteers = 0, failed = false;

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Reports
    const reports = await getDocs(collection(db, 'Report'));

    // Merged reports: the main report lists the duplicates in `mergedReports`.
    // The duplicates are skipped so the merged group counts as ONE report.
    const skipped = [];                       // reports left out of the count (shown in the console)
    const mergedAway = new Set();
    reports.forEach((doc) => {
      const m = doc.data().mergedReports;
      if (Array.isArray(m)) m.forEach((x) => mergedAway.add(String(x && x.id ? x.id : x)));
    });

    reports.forEach((doc) => {
      const d = doc.data();
      if (EXCLUDE_MERGED && (mergedAway.has(doc.id) || mergedAway.has(String(d.reportId || '')))) { skipped.push({ id: doc.id, reason: 'مدموج (مذكور في mergedReports)' }); return; }   // duplicate merged into another report
      if (EXCLUDE_MERGED && (d.mergedInto || d.mergedWith || d.duplicateOf)) { skipped.push({ id: doc.id, reason: 'مدموج (mergedInto/mergedWith/duplicateOf)' }); return; }                        // (in case the duplicate points to its main report)

      // Status spelled "Marged" (or "Merged") = a duplicate that was merged. Skip it unless it is the main report
      // (the main report is the one that holds the `mergedReports` list), so the group counts once.
      const st = String(d.Status || d.status || '').trim();
      const isMergedStatus = /m[ae]rged?|مدمج|مدموج|دمج/i.test(st);
      const isMain = Array.isArray(d.mergedReports) && d.mergedReports.length > 0;
      if (EXCLUDE_MERGED && isMergedStatus && !isMain) { skipped.push({ id: doc.id, reason: 'حالته Marged/Merged: ' + st }); return; }
      const approval = String(d.ApprovalStutes || d.ApprovalStatus || '').toLowerCase();

      // "received" = under review or rejected; once the admin approves it (and it is not found/closed yet) = in progress
      let key = statusKey(d);
      if (/reject|رفض|مرفوض/.test(approval)) key = 'received';        // rejected reports stay in "received" (only approval moves a report to in-progress)
      if (key === 'received' && /approved|مقبول|معتمد/.test(approval)) key = 'progress';
      status[key]++;
      if (key === 'found') foundCount++;

      const rg = String(d.Region || '').trim();
      if (rg) regions[rg] = (regions[rg] || 0) + 1;

      const dt = reportDate(d);
      if (dt) { const day = days.find((x) => x.key === dayKey(dt)); if (day) day.count++; }
    });

    console.log('Charts: Report docs in Firestore =', reports.size, '| counted =', reports.size - skipped.length, '| skipped =', skipped.length);
    if (skipped.length) console.table(skipped);

    // Volunteers (approved + valid account)
    const vols = await getDocs(collection(db, 'Volunteer'));
    vols.forEach((doc) => {
      const v = doc.data();
      if (String(v.ApprovalStatus).toLowerCase() === 'approved' && String(v.AccountStutes).toLowerCase() === 'valid') volunteers++;
    });
  } catch (err) {
    failed = true;
    console.error('Charts: could not read Firestore →', err.code || '', err.message);
  }

  return { days, status, regions, foundCount, volunteers, completed: status.found + status.notfound + status.closed, failed };
}

/* ── Chart.js plugins ───────────────────────────────────── */
const valueLabels = {                       // number above each point
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "800 14px 'Tajawal', sans-serif";
    ctx.fillStyle = C.tealDark;
    ctx.textAlign = 'center';
    chart.getDatasetMeta(0).data.forEach((el, i) =>
      ctx.fillText(chart.data.datasets[0].data[i], el.x, el.y - 12));
    ctx.restore();
  }
};
const valueLabelsH = {
  id: 'valueLabelsH',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "800 14px 'Tajawal', sans-serif";
    ctx.fillStyle = C.tealDark;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((el, i) =>
      ctx.fillText(chart.data.datasets[0].data[i], el.x - 10, el.y));
    ctx.restore();
  }
};
const centerTotal = {                       // total inside the doughnut
  id: 'centerTotal',
  afterDraw(chart) {
    const m = chart.getDatasetMeta(0).data[0];
    if (!m) return;
    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.tealDark;
    ctx.font = "800 36px 'Tajawal', sans-serif";
    ctx.fillText(total, m.x, m.y + 4);
    ctx.fillStyle = C.text;
    ctx.font = "500 14px 'Tajawal', sans-serif";
    ctx.fillText('بلاغ', m.x, m.y + 27);
    ctx.restore();
  }
};

Chart.defaults.font.family = "'Tajawal', sans-serif";
Chart.defaults.color = C.text;
const axisTitle = (text) => ({ display: true, text, font: { size: 13, weight: '700' } });

/* ── Draw ───────────────────────────────────────────────── */
function drawAll({ days, status, regions, foundCount, volunteers, completed, failed }) {

  // Doughnut — status
  if ($('statusDoughnutChart')) {
    const total = STATUS.reduce((a, s) => a + status[s.key], 0);
    charts.status = new Chart($('statusDoughnutChart'), {
      type: 'doughnut',
      data: {
        labels: STATUS.map((s) => s.label),
        datasets: [{
          data: STATUS.map((s) => status[s.key]),
          backgroundColor: STATUS.map((s) => s.color),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { display: false } } },
      plugins: [centerTotal]
    });
    if ($('statusLegend')) $('statusLegend').innerHTML = STATUS.filter((s) => s.key !== 'closed' || status.closed > 0).map((s) => {
      const n = status[s.key];
      const pct = total ? Math.round((n / total) * 100) : 0;
      return '<span class="leg-item"><span class="leg-dot" style="background:' + s.color + '"></span>' +
             s.label + ' <bdi dir="ltr">' + n + ' - ' + pct + '%</bdi></span>';
    }).join('');
    if ($('counterTotalReports')) $('counterTotalReports').textContent = total;
    if ($('counterFoundReports')) $('counterFoundReports').textContent = foundCount;
  }

  // Tab 1 — line, last 7 days
  if ($('reportsLineChart')) {
    charts.line = new Chart($('reportsLineChart'), {
      type: 'line',
      data: {
        labels: days.map((d) => d.label),
        datasets: [{
          label: 'عدد البلاغات',
          data: days.map((d) => d.count),
          borderColor: C.teal,
          backgroundColor: (ctx) => {
            const a = ctx.chart.chartArea;
            if (!a) return 'rgba(79,138,107,0.15)';
            const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
            g.addColorStop(0, 'rgba(79,138,107,0.35)');
            g.addColorStop(1, 'rgba(79,138,107,0.02)');
            return g;
          },
          pointBackgroundColor: '#fff',
          pointBorderColor: C.teal,
          pointBorderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 26, right: 28, left: 12 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { reverse: true, grid: { display: false } },            // RTL: oldest day on the right
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: C.grid }, title: axisTitle('عدد البلاغات') }
        }
      },
      plugins: [valueLabels]
    });
    if ($('lineTotal')) $('lineTotal').textContent = 'المجموع: ' + days.reduce((a, d) => a + d.count, 0) + ' بلاغ';
  }

  // Tab 2 — horizontal bars, all 13 regions (zero included), sorted high → low
  if ($('regionBarChart')) {
    const list = REGIONS.map((r) => [r, regions[r] || 0]).sort((a, b) => b[1] - a[1]);
    charts.region = new Chart($('regionBarChart'), {
      type: 'bar',
      data: {
        labels: list.map((r) => r[0]),
        datasets: [{
          label: 'عدد البلاغات',
          data: list.map((r) => r[1]),
          backgroundColor: C.teal,
          hoverBackgroundColor: C.orange,
          borderRadius: 8,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 28 } },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            reverse: true,
            beginAtZero: true,
            grace: '12%',                       // space after the longest bar
            ticks: { precision: 0 },
            grid: { color: C.grid },
            title: axisTitle('عدد البلاغات')
          },
          y: { grid: { display: false } }
        }
      },
      plugins: [valueLabelsH]
    });
    if ($('regionTotal')) $('regionTotal').textContent =
      'المجموع: ' + list.reduce((a, r) => a + r[1], 0) + ' بلاغ';
  }

  if ($('counterActiveVolunteers')) $('counterActiveVolunteers').textContent = volunteers;
  if ($('counterCompletedMissions')) $('counterCompletedMissions').textContent = completed;

  document.querySelectorAll('.demo-note').forEach((el) => {
    el.textContent = 'تعذر تحميل البيانات حالياً';
    el.hidden = !failed;
  });
}

/* ── Tabs ───────────────────────────────────────────────── */
function initTabs() {
  const tabs = document.querySelectorAll('.chart-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); });
      document.querySelectorAll('.chart-panel').forEach((p) => (p.hidden = p.id !== tab.dataset.target));
      Object.values(charts).forEach((c) => c.resize());   // redraw at the right size once visible
    });
  });
}

function start() { initTabs(); loadData().then(drawAll); }
if (document.readyState === 'complete') start();
else window.addEventListener('load', start);