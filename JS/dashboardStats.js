/* dashboardStats.js
   ============================================================
   Loads live counts from Firestore (Report / Volunteer / Detection)
   and updates the #stats section on index.html.

   Definitions:
   - عدد المهام المنفذة  = Report docs where Status == "rescued"
   - المتطوعون النشطون   = Volunteer docs where AccountStutes == "valid"
   - عمليات الرصد (counter) = total Detection docs (Detection collection,
     not built yet — counts as 0 until it exists)
   - نسبة الدقة          = rescued / (total reports - merged reports) * 100
   - توزيع الحالات (doughnut) = قيد المعالجة (Status == "active")
     vs مغلق (Status == "rescued") — everything else is excluded
   ============================================================ */

import { db } from './firebase.js';
import {
  collection,
  query,
  where,
  getCountFromServer,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Adjust these if the actual stored casing differs (Firestore string
// equality is case-sensitive).
const STATUS_RESCUED = 'rescued';
const STATUS_ACTIVE  = 'active';
const STATUS_MERGED  = 'merged';

const ARABIC_WEEKDAYS       = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_WEEKDAYS_SHORT = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمس', 'جمع', 'سبت'];

async function countOf(q) {
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// Detection collection doesn't exist yet — don't let that break the page.
async function safeCountOf(q) {
  try {
    return await countOf(q);
  } catch (err) {
    console.warn('dashboardStats: count query failed, defaulting to 0', err);
    return 0;
  }
}

async function loadStats() {
  const reportsCol    = collection(db, 'Report');
  const volunteersCol = collection(db, 'Volunteer');
  const detectionsCol = collection(db, 'Detection'); // rename here once the real collection name is set

  const [
    totalReports,
    rescuedReports,
    mergedReports,
    activeReports,
    activeVolunteers,
    totalDetections,
  ] = await Promise.all([
    countOf(reportsCol),
    countOf(query(reportsCol, where('Status', '==', STATUS_RESCUED))),
    countOf(query(reportsCol, where('Status', '==', STATUS_MERGED))),
    countOf(query(reportsCol, where('Status', '==', STATUS_ACTIVE))),
    countOf(query(volunteersCol, where('AccountStutes', '==', 'valid'))),
    safeCountOf(detectionsCol),
  ]);

  // نسبة الدقة = rescued / (total - merged) * 100 — merged reports are excluded entirely
  const accuracyDenominator = Math.max(totalReports - mergedReports, 0);
  const accuracyPct = accuracyDenominator > 0
    ? Math.round((rescuedReports / accuracyDenominator) * 100)
    : 0;

  // last 7 days, per-day report counts (for the weekly line chart)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = await Promise.all(
    Array.from({ length: 7 }, (_, idx) => {
      const offsetFromToday = 6 - idx; // oldest -> newest
      const start = new Date(today);
      start.setDate(start.getDate() - offsetFromToday);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const dayQuery = query(
        reportsCol,
        where('LoggedAt', '>=', Timestamp.fromDate(start)),
        where('LoggedAt', '<',  Timestamp.fromDate(end)),
      );
      return countOf(dayQuery).then((count) => ({ date: start, count }));
    })
  );

  return {
    completedMissions: rescuedReports,   // عدد المهام المنفذة
    activeVolunteers,                    // المتطوعون النشطون
    totalDetections,                     // عمليات الرصد (counter card)
    accuracyPct,                         // نسبة الدقة
    distribution: {
      activeReports,                     // قيد المعالجة
      rescuedReports,                    // مغلق
    },
    weekly: {
      counts: days.map((d) => d.count),
      fullLabels: days.map((d) => ARABIC_WEEKDAYS[d.date.getDay()]),
      shortLabels: days.map((d) => ARABIC_WEEKDAYS_SHORT[d.date.getDay()]),
    },
  };
}

function updateCounters(stats) {
  const targets = {
    counterCompletedMissions: stats.completedMissions,
    counterActiveVolunteers: stats.activeVolunteers,
    counterMonitoringOps: stats.totalDetections,
    counterAccuracy: stats.accuracyPct,
  };
  Object.entries(targets).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.dataset.target = value;
  });
}

function updateCharts(stats) {
  const { activeReports, rescuedReports } = stats.distribution;
  const total = activeReports + rescuedReports || 1;
  const pct = (n) => Math.round((n / total) * 100);

  if (window.rasidDoughnutChart) {
    window.rasidDoughnutChart.data.datasets[0].data = [activeReports, rescuedReports];
    window.rasidDoughnutChart.update();
  }

  const legendValues = {
    legendProgress: pct(activeReports),
    legendClosed: pct(rescuedReports),
  };
  Object.entries(legendValues).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value + '%';
  });

  if (window.rasidLineChart) {
    window.rasidLineChart.data.datasets[0].data = stats.weekly.counts;
    window.rasidLineChart.data.labels = window.innerWidth < 480
      ? stats.weekly.shortLabels
      : stats.weekly.fullLabels;
    window.rasidLineChartDays = { full: stats.weekly.fullLabels, short: stats.weekly.shortLabels };
    window.rasidLineChart.update();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const stats = await loadStats();
    updateCounters(stats);
    updateCharts(stats);
  } catch (err) {
    console.error('dashboardStats: failed to load live stats', err);
  }
});