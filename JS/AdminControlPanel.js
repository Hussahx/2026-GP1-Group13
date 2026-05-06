/* ════════════════════════════════════════════════════
   AdminControlPanel.js — طلبات تسجيل المتطوعين
   Tabs: الكل | معلّقة | مقبول | مرفوض
   Pagination + Control.html-style modal
════════════════════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);

let requests    = [];
let TAB         = 'all';
let SRCH        = '';
let SORT        = 'newest';
let currentPage = 1;
const PER_PAGE  = 10;
let pendingAction = null;

/* ── Helpers ── */
function formatDateTime(dt = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function initials(name = '؟') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '؟') + (parts[1]?.[0] ?? '')).toUpperCase();
}
function escapeHtml(s) {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function showToast(msg) {
  const box = $('#toastBox');
  $('#toastText').textContent = msg;
  box.style.display = 'inline-flex';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { box.style.display = 'none'; }, 2600);
}
function normalizeTimestamp(ts) {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  return Date.now();
}
function generateTemporaryPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < length; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  return pw;
}

/* ── Status mapping ── */
function mapStatus(raw) {
  const m = {
    'pending':  'pending',
    'approved': 'accepted',
    'accepted': 'accepted',
    'rejected': 'rejected',
    'valid':    'accepted',
  };
  return m[(raw||'').toLowerCase()] || 'pending';
}
function statusLabel(s) {
  return { pending:'معلّق', accepted:'مقبول', rejected:'مرفوض' }[s] || s;
}
function statusClass(s) {
  return { pending:'tag-pend', accepted:'tag-acc', rejected:'tag-rej' }[s] || '';
}

/* ── Firestore ── */
async function fetchAllRequests() {
  const [{ db }, fsMod] = await Promise.all([
    import('/JS/firebase.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const { collection, getDocs } = fsMod;
  const snap = await getDocs(collection(db, 'Volunteer'));
  return snap.docs.map(vDoc => {
    const d = vDoc.data();
    const fullName = `${d.FirstName||''} ${d.LastName||''}`.trim();
    const rawStatus = d.ApprovalStatus || d.approvalStatus || 'pending';
    return {
      id:        vDoc.id,
      name:      fullName || 'بدون اسم',
      email:     d.Email || '—',
      phone:     d.Phone || '—',
      city:      d.City  || '—',
      nationalId: d.NationalID || '—',
      dob:       d.DOB   || '—',
      skills:    Array.isArray(d.Skills) ? d.Skills : [],
      availableDays: Array.isArray(d.AvailableDays) ? d.AvailableDays : [],
      availableSchedule: d.AvailableSchedule || {},
      nationalFile: d.NationalFile || '',
      status:    mapStatus(rawStatus),
      rawStatus,
      createdAt: normalizeTimestamp(d.JoinDate),
    };
  });
}

async function acceptRequest(id) {
  const [{ db }, fsMod, authMod] = await Promise.all([
    import('/JS/firebase.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
  ]);
  const { doc, getDoc, updateDoc, serverTimestamp } = fsMod;
  const { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } = authMod;

  const volRef  = doc(db, 'Volunteer', id);
  const volSnap = await getDoc(volRef);
  if (!volSnap.exists()) throw new Error('الطلب غير موجود');

  const volunteer = volSnap.data();
  const email     = volunteer.Email || '';
  const fullName  = `${volunteer.FirstName||''} ${volunteer.LastName||''}`.trim() || 'المتطوع';
  if (!email) throw new Error('لا يوجد إيميل للمتطوع');

  const auth = getAuth();
  let uid = id;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, generateTemporaryPassword());
    uid = cred.user.uid;
  } catch (err) {
    if (err.code !== 'auth/email-already-in-use') throw err;
  }

  await updateDoc(volRef, {
    ApprovalStatus: 'approved',
    AccountStutes:  'valid',
    Status:         'active',
    AuthUID:        uid,
    role:           'volunteer',
    approvedAt:     serverTimestamp()
  });

  await sendPasswordResetEmail(auth, email);
  return { email, fullName };
}

async function rejectRequest(id, reason) {
  const [{ db }, fsMod] = await Promise.all([
    import('/JS/firebase.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const { doc, getDoc, updateDoc, serverTimestamp } = fsMod;
  const volRef  = doc(db, 'Volunteer', id);
  const volSnap = await getDoc(volRef);
  if (!volSnap.exists()) throw new Error('الطلب غير موجود');
  const d = volSnap.data();
  await updateDoc(volRef, {
    ApprovalStatus:  'rejected',
    Status:          'rejected',
    RejectionReason: reason || '',
    rejectedAt:      serverTimestamp()
  });
  return { email: d.Email||'', fullName: `${d.FirstName||''} ${d.LastName||''}`.trim()||'المتطوع', reason };
}

async function sendVolunteerEmail({ type, name, email, reason = '' }) {
  const emailjs = await import('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm');
  const isAccepted = type === 'accepted';
  emailjs.default.init('EY2NhkcwxrvArGrdR');
  await emailjs.default.send('service_7c6tubl', 'template_bb87v3a', {
    to_email: email,
    subject:  isAccepted ? 'تهانينا بانضمامك إلى منصة راصد' : 'نتيجة طلب الانضمام إلى منصة راصد',
    name,
    main_message: isAccepted
      ? 'يسعدنا إبلاغك بأنه تم قبول طلب انضمامك كمتطوع في منصة راصد.'
      : 'نأسف لإبلاغك بأنه تعذر قبول طلبك في الوقت الحالي.',
    details: isAccepted
      ? `البريد الإلكتروني: ${email}\nيرجى استخدام رابط إعادة تعيين كلمة المرور المرسل إلى بريدك.`
      : `سبب الرفض:\n${reason}`,
    closing_message: isAccepted ? 'نسعد بانضمامك إلينا.' : 'نتمنى لك التوفيق مستقبلًا.'
  });
}

/* ── Filter + sort ── */
function getFiltered() {
  let list = [...requests];
  if (TAB !== 'all') list = list.filter(r => r.status === TAB);
  if (SRCH) {
    const q = SRCH.toLowerCase();
    list = list.filter(r =>
      `${r.name} ${r.email} ${r.phone}`.toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => SORT === 'oldest'
    ? (a.createdAt||0) - (b.createdAt||0)
    : (b.createdAt||0) - (a.createdAt||0)
  );
  return list;
}

/* ── Render ── */
function updateCounters() {
  const all  = requests.length;
  const pend = requests.filter(r => r.status === 'pending').length;
  const acc  = requests.filter(r => r.status === 'accepted').length;
  const rej  = requests.filter(r => r.status === 'rejected').length;
  const tcAll = $('#tcAll');       if (tcAll) tcAll.textContent = String(all);
  const tcP   = $('#tcPending');   if (tcP)   tcP.textContent   = String(pend);
  const tcA   = $('#tcAccepted'); if (tcA)   tcA.textContent   = String(acc);
  const tcR   = $('#tcRejected'); if (tcR)   tcR.textContent   = String(rej);
  $('#lastUpdated').textContent = formatDateTime(new Date());
}

function render() {
  const list  = getFiltered();
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start    = (currentPage - 1) * PER_PAGE;
  const pageList = list.slice(start, start + PER_PAGE);

  const listEl  = $('#list');
  const emptyEl = $('#empty');
  const pgWrap  = $('#pgWrap');

  updateCounters();

  if (!pageList.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    if (pgWrap) pgWrap.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = pageList.map(r => {
    const created    = new Date(r.createdAt || Date.now());
    const skillsText = r.skills.length ? r.skills.join('، ') : '—';
    const daysText   = r.availableDays.length ? r.availableDays.join('، ') : '—';
    const schedText  = Object.keys(r.availableSchedule||{}).length
      ? Object.entries(r.availableSchedule).map(([d,t]) => `${d}: ${t}`).join(' | ')
      : '—';
    const fileLink = r.nationalFile
      ? `<a href="${escapeHtml(r.nationalFile)}" target="_blank" rel="noopener">عرض الملف</a>`
      : '—';

    // Action buttons — show accept/reject only for pending
    let actionBtns = '';
    if (r.status === 'pending') {
      actionBtns = `
        <button class="btn" type="button" data-action="accept">
          <i class="fa-solid fa-check"></i><span class="btn-label">قبول</span>
        </button>
        <button class="btn danger" type="button" data-action="reject">
          <i class="fa-solid fa-xmark"></i><span class="btn-label">رفض</span>
        </button>`;
    }

    return `
  <article class="card request-card" data-id="${escapeHtml(r.id)}">
    <div class="req-main" data-toggle="details">
      <div class="req-avatar av-${r.status}" aria-hidden="true">${escapeHtml(r.name.trim().charAt(0))}</div>
      <div class="req-meta">
        <div class="req-title">
          <span>${escapeHtml(r.name)}</span>
          <span class="tag ${statusClass(r.status)}">${statusLabel(r.status)}</span>
          <span class="tag"><i class="fa-regular fa-calendar"></i>${escapeHtml(formatDateTime(created))}</span>
        </div>
        <div class="req-sub">
          <span><i class="fa-regular fa-envelope"></i> ${escapeHtml(r.email)}</span>
          <span><i class="fa-solid fa-phone"></i> ${escapeHtml(r.phone)}</span>
        </div>
      </div>
      <div class="req-actions">${actionBtns}</div>
    </div>
    <div class="req-details" style="display:none;">
      <span>المدينة: ${escapeHtml(r.city)}</span>
      <span>رقم الهوية: ${escapeHtml(r.nationalId)}</span>
      <span>تاريخ الميلاد: ${escapeHtml(r.dob)}</span>
      <span>المهارات: ${escapeHtml(skillsText)}</span>
      <span>الأيام المتاحة: ${escapeHtml(daysText)}</span>
      <span>الفترة: ${escapeHtml(schedText)}</span>
      <span>ملف الهوية: ${fileLink}</span>
    </div>
  </article>`;
  }).join('');

  // Pagination
  if (!pgWrap) return;
  if (totalPages <= 1) { pgWrap.style.display = 'none'; return; }
  pgWrap.style.display = 'flex';

  let pgHtml = `<button class="pg-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>&#8249;</button>`;

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage-2 && p <= currentPage+2)) {
      pages.push(p);
    } else if (pages[pages.length-1] !== '…') {
      pages.push('…');
    }
  }
  pages.forEach(p => {
    if (p === '…') {
      pgHtml += '<span class="pg-info">…</span>';
    } else {
      pgHtml += `<button class="pg-btn${p===currentPage?' active':''}" onclick="goPage(${p})">${p}</button>`;
    }
  });
  pgHtml += `<button class="pg-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>&#8250;</button>`;
  pgHtml += `<span class="pg-info">${currentPage} / ${totalPages}</span>`;
  pgWrap.innerHTML = pgHtml;
}

function goPage(p) {
  const total = Math.max(1, Math.ceil(getFiltered().length / PER_PAGE));
  if (p < 1 || p > total) return;
  currentPage = p;
  render();
  listEl && listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Tab switch ── */
function switchTab(btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  btn.classList.add('on');
  TAB = btn.dataset.tab;
  currentPage = 1;
  render();
}

/* ── Modal (Control.html style) ── */
function openDecisionModal(type, id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  pendingAction = { type, id, name: r.name, email: r.email };

  const icon  = $('#mIcon');
  const title = $('#mTitle');
  const sub   = $('#mSub');
  const det   = $('#mDetails');
  const btn   = $('#confirmActionBtn');
  const rjWrap = $('#rejectReasonWrap');
  if ($('#rejectReason')) $('#rejectReason').value = '';

  if (type === 'accept') {
    icon.className   = 'mhead-icon mhi-acc';
    icon.innerHTML   = '<i class="fas fa-circle-check"></i>';
    title.textContent = 'قبول الطلب';
    sub.textContent  = `هل تريد قبول ${r.name}؟ سيتم إنشاء حساب وإرسال إيميل إليه.`;
    btn.className    = 'mbtn mbtn-acc';
    btn.textContent  = 'تأكيد القبول';
    if (rjWrap) rjWrap.style.display = 'none';
  } else {
    icon.className   = 'mhead-icon mhi-rej';
    icon.innerHTML   = '<i class="fas fa-circle-xmark"></i>';
    title.textContent = 'رفض الطلب';
    sub.textContent  = `هل تريد رفض ${r.name}؟`;
    btn.className    = 'mbtn mbtn-rej';
    btn.textContent  = 'تأكيد الرفض';
    if (rjWrap) rjWrap.style.display = 'block';
  }

  if (det) det.innerHTML = di('الاسم', r.name) + di('البريد الإلكتروني', r.email) + di('الهاتف', r.phone);
  btn.onclick = () => execAction();
  $('#confirmOvr').classList.add('on');
}

function closeConfirmModal() {
  pendingAction = null;
  $('#confirmOvr').classList.remove('on');
}

async function execAction() {
  if (!pendingAction) return;
  const { type, id, name } = pendingAction;
  const reason = ($('#rejectReason') || {}).value?.trim() || '';
  const btn    = $('#confirmActionBtn');

  if (type === 'reject' && !reason) {
    showToast('اكتب سبب الرفض أولًا');
    $('#rejectReason')?.focus();
    return;
  }

  btn.disabled = true;
  try {
    if (type === 'accept') {
      const result = await acceptRequest(id);
      try {
        await sendVolunteerEmail({ type: 'accepted', name: result.fullName, email: result.email });
        showToast(`✓ تم قبول ${name} وإرسال الإيميل`);
      } catch {
        showToast(`✓ تم قبول ${name} (فشل إرسال الإيميل)`);
      }
    } else {
      const result = await rejectRequest(id, reason);
      try {
        await sendVolunteerEmail({ type: 'rejected', name: result.fullName, email: result.email, reason });
        showToast(`✗ تم رفض ${name} وإرسال الإيميل`);
      } catch {
        showToast(`✗ تم رفض ${name} (فشل إرسال الإيميل)`);
      }
    }
    closeConfirmModal();
    await reload(false);
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء تنفيذ العملية');
  } finally {
    btn.disabled = false;
  }
}

function di(l, v) {
  return `<div class="di"><div class="dl">${escapeHtml(l)}</div><div class="dv">${escapeHtml(v)}</div></div>`;
}

/* ── Event listeners ── */
$('#searchInput').addEventListener('input', function () {
  SRCH = this.value.trim();
  currentPage = 1;
  render();
});

const srtEl = $('#srtSelect');
if (srtEl) srtEl.addEventListener('change', function () {
  SORT = this.value;
  currentPage = 1;
  render();
});

$('#refreshBtn').addEventListener('click', async () => {
  await reload();
  showToast('تم التحديث');
});

$('#list').addEventListener('click', async e => {
  const btn  = e.target.closest('button[data-action]');
  const card = e.target.closest('[data-id]');
  const id   = card?.getAttribute('data-id');
  if (!id) return;

  if (btn) {
    const action = btn.getAttribute('data-action');
    openDecisionModal(action, id);
    return;
  }

  const toggle = e.target.closest('[data-toggle="details"]');
  if (toggle) {
    const det = card.querySelector('.req-details');
    if (det) det.style.display = det.style.display === 'none' ? 'grid' : 'none';
  }
});

$('#confirmOvr')?.addEventListener('click', e => { if (e.target === $('#confirmOvr')) closeConfirmModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeConfirmModal(); });

/* ── Load ── */
async function reload(showMsg = true) {
  try {
    if (showMsg) showToast('جاري التحميل...');
    requests = await fetchAllRequests();
    currentPage = 1;
    render();
  } catch (err) {
    console.error(err);
    requests = [];
    render();
    showToast('تعذر تحميل الطلبات');
  }
}

reload(true);