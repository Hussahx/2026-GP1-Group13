const API = {};

    const STORAGE_KEY = "admin_pending_requests_v1";
    let requests = [];
    let filtered = [];
  let pendingAction = null;
    const $ = (sel) => document.querySelector(sel);

    function formatDateTime(dt = new Date()){
      const pad = (n) => String(n).padStart(2,"0");
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }

    function initials(name="؟"){
      const parts = String(name).trim().split(/\s+/).filter(Boolean);
      const a = parts[0]?.[0] ?? "؟";
      const b = parts[1]?.[0] ?? "";
      return (a + b).toUpperCase();
    }

    function escapeHtml(s){
      return String(s)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    function showToast(msg){
      const box = $("#toastBox");
      $("#toastText").textContent = msg;
      box.style.display = "inline-flex";
      clearTimeout(showToast._t);
      showToast._t = setTimeout(()=>{ box.style.display = "none"; }, 2200);
    }

    function updateHeader(){
      $("#pendingCount").textContent = String(filtered.length);
      $("#lastUpdated").textContent = formatDateTime(new Date());
    }

    function saveLocal(){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    }

    function loadLocal(){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        try { return JSON.parse(raw) || []; } catch { return []; }
      }
      return [];
    }

    function seedIfEmpty(){
      const existing = loadLocal();
      if(existing.length) return existing;

      const demo = [
        { id: crypto.randomUUID(), name:"سارة أحمد", email:"sara@example.com", phone:"+9665xxxxxxx", createdAt: Date.now() - 1000*60*25 },
        { id: crypto.randomUUID(), name:"محمد علي", email:"mohammad@example.com", phone:"+9665xxxxxxx", createdAt: Date.now() - 1000*60*80 },
        { id: crypto.randomUUID(), name:"نور فيصل", email:"noor@example.com", phone:"+9665xxxxxxx", createdAt: Date.now() - 1000*60*180 },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }




    function normalizeTimestamp(ts) {
  if (!ts) return Date.now();
  if (typeof ts === "number") return ts;
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  return Date.now();
}

function generateTemporaryPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

async function sendVolunteerEmail({ type, name, email, password = "", reason = "" }) {
  const emailjs = await import('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm');

 const websiteLink = "https://database-b28a1.web.app";

const isAccepted = type === "accepted";

const subject = isAccepted
  ? "تهانينا بانضمامك إلى منصة راصد"
  : "";

const main_message = isAccepted
  ? `

يسعدنا إبلاغك بأنه تم قبول طلب انضمامك كمتطوع في منصة راصد.

نرحب بك ضمن فريقنا، ونتطلع إلى مساهمتك معنا في دعم جهود البحث والإنقاذ، وإحداث أثر إيجابي في المجتمع.`
  : `مرحبًا 

نشكر لك اهتمامك بالانضمام إلى منصة راصد.

نأسف لإبلاغك بأنه تعذر قبول طلبك في الوقت الحالي، وذلك بعد مراجعة البيانات المقدمة.`;

const details = isAccepted
  ? `بيانات الدخول:

البريد الإلكتروني: ${email}
كلمة المرور المؤقتة: ${password}

يرجى تغيير كلمة المرور بعد تسجيل الدخول.`
  : `سبب الرفض:
${reason}`;

const closing_message = isAccepted
  ? `للدخول إلى المنصة:
${websiteLink}

نسعد بانضمامك إلينا.`
  : `نتمنى لك التوفيق مستقبلًا.`;

emailjs.default.init('EY2NhkcwxrvArGrdR');

await emailjs.default.send("service_7c6tubl", "template_bb87v3a", {
  to_email: email,
  subject,
  name,
  main_message,
  details,
  closing_message
});
}





    async function fetchPendingRequests() {
  const [{ db }, fsMod] = await Promise.all([
    import('/JS/firebase.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);

  const { collection, query, where, getDocs } = fsMod;

  const q = query(
    collection(db, "Volunteer"),
    where("ApprovalStatus", "==", "pending")
  );

  const volunteerSnap = await getDocs(q);

  const rows = volunteerSnap.docs.map((vDoc) => {
    const volunteer = vDoc.data();

    const fullName = `${volunteer.FirstName || ""} ${volunteer.LastName || ""}`.trim();

    return {
      id: vDoc.id,
      name: fullName || "بدون اسم",
      email: volunteer.Email || "—",
      phone: volunteer.Phone || "—",
      city: volunteer.City || "—",
      nationalId: volunteer.NationalID || "—",
      dob: volunteer.DOB || "—",
      skills: Array.isArray(volunteer.Skills) ? volunteer.Skills : [],
      availableDays: Array.isArray(volunteer.AvailableDays) ? volunteer.AvailableDays : [],
      availablePeriod: volunteer.AvailablePeriods || "—",
      nationalFile: volunteer.NationalFile || "",
      createdAt: normalizeTimestamp(volunteer.JoinDate)
    };
  });

  return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}


   async function acceptRequest(id) {
  const [{ db }, fsMod, authMod] = await Promise.all([
    import('/JS/firebase.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
  ]);

  const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = fsMod;
  const { getAuth, createUserWithEmailAndPassword } = authMod;

  const volunteerRef = doc(db, "Volunteer", id);
  const volunteerSnap = await getDoc(volunteerRef);

  if (!volunteerSnap.exists()) {
    throw new Error("الطلب غير موجود");
  }

  const volunteer = volunteerSnap.data();

  const email = volunteer.Email || "";
  const fullName = `${volunteer.FirstName || ""} ${volunteer.LastName || ""}`.trim() || "المتطوع";

  if (!email) {
    throw new Error("لا يوجد إيميل للمتطوع");
  }

  const temporaryPassword = generateTemporaryPassword();
  const auth = getAuth();

  let uid = id;

try {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    temporaryPassword
  );

  uid = userCredential.user.uid;
} catch (error) {
  if (error.code === "auth/email-already-in-use") {
    console.log("المستخدم موجود مسبقًا، سيتم إكمال القبول بدون إنشاء حساب جديد");
    uid = id;
  } else {
    throw error;
  }
}

  await setDoc(doc(db, "User", uid), {
    FirstName: volunteer.FirstName || "",
    LastName: volunteer.LastName || "",
    Email: email,
    Phone: volunteer.Phone || "",
    CreatedAt: serverTimestamp(),
    Role: "volunteer",
    AccountStatus: "active"
  });

  await updateDoc(volunteerRef, {
    ApprovalStatus: "approved",
    Status: "active",
    UserID: uid,
    approvedAt: serverTimestamp()
  });

 return {
  email,
  fullName,
  password: temporaryPassword
};
}


  async function rejectRequest(id, reason) {
  const [{ db }, fsMod] = await Promise.all([
    import('/JS/firebase.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);

  const { doc, getDoc, updateDoc, serverTimestamp } = fsMod;

  const volunteerRef = doc(db, "Volunteer", id);
  const volunteerSnap = await getDoc(volunteerRef);

  if (!volunteerSnap.exists()) {
    throw new Error("الطلب غير موجود");
  }

  const volunteer = volunteerSnap.data();

  const email = volunteer.Email || "";
  const fullName = `${volunteer.FirstName || ""} ${volunteer.LastName || ""}`.trim() || "المتطوع";

  await updateDoc(volunteerRef, {
    ApprovalStatus: "rejected",
    Status: "rejected",
    RejectionReason: reason || "",
    rejectedAt: serverTimestamp()
  });

  return {
    email,
    fullName,
    reason
  };
}


function render() {
  const list = $("#list");
  list.innerHTML = "";

  if (filtered.length === 0) {
    $("#empty").style.display = "block";
  } else {
    $("#empty").style.display = "none";
  }

  for (const r of filtered) {
    const created = new Date(r.createdAt || Date.now());
    const skillsText = r.skills.length ? r.skills.join("، ") : "—";
    const daysText = r.availableDays.length ? r.availableDays.join("، ") : "—";
    const fileLink = r.nationalFile
      ? `<a href="${escapeHtml(r.nationalFile)}" target="_blank" rel="noopener noreferrer">عرض الملف</a>`
      : "—";

    const html = `
      <article class="card request-card" data-id="${escapeHtml(r.id)}" style="padding: 0; overflow: hidden;">
        
        <div class="req-main" data-toggle="details"
             style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem; cursor:pointer;">

          <!-- RIGHT: avatar -->
          <div class="req-avatar" aria-hidden="true">${escapeHtml(initials(r.name))}</div>

          <!-- CENTER: meta -->
          <div class="req-meta" style="flex:1; min-width:0;">
            <div class="req-title">
              <span>${escapeHtml(r.name || "بدون اسم")}</span>
              <span class="tag"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>معلّق</span>
              <span class="tag"><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(formatDateTime(created))}</span>
            </div>
            <div class="req-sub">
              <span><i class="fa-regular fa-envelope" aria-hidden="true"></i> ${escapeHtml(r.email || "—")}</span>
              <span><i class="fa-solid fa-phone" aria-hidden="true"></i> ${escapeHtml(r.phone || "—")}</span>
            </div>
          </div>

          <!-- LEFT: actions -->
          <div class="req-actions" style="display:flex; gap:.6rem; flex-shrink:0;">
            <button class="btn" type="button" data-action="accept" title="قبول الطلب" style="height:44px;">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
              <span class="btn-label">قبول</span>
            </button>
            <button class="btn danger" type="button" data-action="reject" title="رفض الطلب" style="height:44px;">
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
              <span class="btn-label">رفض</span>
            </button>
          </div>

        </div>

        <div class="req-details"
             style="display:${r.isOpen ? 'block' : 'none'}; padding:0 1rem 1rem; border-top:1px solid rgba(166,124,82,0.12); background:rgba(245,239,230,0.28);">
          
          <div class="req-sub" style="margin-top:12px; flex-wrap:wrap;">
            <span><strong>المدينة:</strong> ${escapeHtml(r.city)}</span>
            <span><strong>رقم الهوية:</strong> ${escapeHtml(r.nationalId)}</span>
            <span><strong>تاريخ الميلاد:</strong> ${escapeHtml(r.dob)}</span>
          </div>

          <div class="req-sub" style="margin-top:12px; flex-wrap:wrap;">
            <span><strong>المهارات:</strong> ${escapeHtml(skillsText)}</span>
            <span><strong>الأيام المتاحة:</strong> ${escapeHtml(daysText)}</span>
            <span><strong>الفترة:</strong> ${escapeHtml(r.availablePeriod)}</span>
          </div>

          <div class="req-sub" style="margin-top:12px; flex-wrap:wrap;">
            <span><strong>ملف الهوية:</strong> ${fileLink}</span>
          </div>
        </div>
      </article>
    `;
    list.insertAdjacentHTML("beforeend", html);
  }

  updateHeader();
}
    function applyFilter(){
      const q = $("#searchInput").value.trim().toLowerCase();
      if(!q){
        filtered = [...requests].sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
      }else{
        filtered = requests.filter(r => {
          const hay = `${r.name||""} ${r.email||""} ${r.phone||""}`.toLowerCase();
          return hay.includes(q);
        }).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
      }
      render();
    }

    function openDecisionModal(type, id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;

  pendingAction = {
    type,
    id,
    name: r.name,
    email: r.email
  };

  $("#modalTitle").textContent = type === "accept" ? "تأكيد القبول" : "تأكيد الرفض";
  $("#modalSubtitle").textContent =
    type === "accept"
      ? `هل أنت متأكد من قبول ${r.name}؟`
      : `هل أنت متأكد من رفض ${r.name}؟`;

  $("#confirmActionLabel").textContent =
    type === "accept" ? "تأكيد القبول" : "تأكيد الرفض";

  $("#rejectReason").value = "";
  $("#rejectReasonWrap").style.display = type === "reject" ? "grid" : "none";

  $("#modalBackdrop").style.display = "flex";
  $("#modalBackdrop").setAttribute("aria-hidden", "false");

  if (type === "reject") {
    $("#rejectReason").focus();
  } else {
    $("#confirmActionBtn").focus();
  }
}

function closeDecisionModal() {
  pendingAction = null;
  $("#rejectReason").value = "";
  $("#modalBackdrop").style.display = "none";
  $("#modalBackdrop").setAttribute("aria-hidden", "true");
}

    $("#searchInput").addEventListener("input", applyFilter);

    $("#refreshBtn").addEventListener("click", async ()=>{
      await reload();
      showToast("تم التحديث");
    });

 $("#list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  const card = e.target.closest("[data-id]");
  const id = card?.getAttribute("data-id");
  if (!id) return;

  if (btn) {
    const action = btn.getAttribute("data-action");

    if (action === "accept") {
  openDecisionModal("accept", id);
  return;
}

if (action === "reject") {
  openDecisionModal("reject", id);
  return;
}
  }

  const toggleArea = e.target.closest('[data-toggle="details"]');
  if (toggleArea) {
    requests = requests.map((r) =>
      r.id === id ? { ...r, isOpen: !r.isOpen } : r
    );
    applyFilter();
  }
});

   $("#closeModalBtn").addEventListener("click", closeDecisionModal);
$("#cancelRejectBtn").addEventListener("click", closeDecisionModal);

$("#modalBackdrop").addEventListener("click", (e) => {
  if (e.target === $("#modalBackdrop")) closeDecisionModal();
});

$("#confirmActionBtn").addEventListener("click", async () => {
  if (!pendingAction) return;

  const { type, id, name } = pendingAction;
  const reason = $("#rejectReason").value.trim();
  const confirmBtn = $("#confirmActionBtn");

  if (type === "reject" && !reason) {
    showToast("اكتب سبب الرفض أولًا");
    $("#rejectReason").focus();
    return;
  }

  confirmBtn.disabled = true;
  confirmBtn.classList.add("loading");

  try {
    if (type === "accept") {const result = await acceptRequest(id);

try {
  await sendVolunteerEmail({
    type: "accepted",
    name: result.fullName,
    email: result.email,
    password: result.password
  });

  showToast(`تم قبول ${name} وإرسال الإيميل`);
} catch (emailErr) {
  console.error("Accept email error:", emailErr);
  showToast(`تم قبول ${name} لكن فشل إرسال الإيميل`);
}

closeDecisionModal();
await reload(false);
    }

    if (type === "reject") {const result = await rejectRequest(id, reason);

try {
  await sendVolunteerEmail({
    type: "rejected",
    name: result.fullName,
    email: result.email,
    reason: result.reason
  });

  showToast(`تم رفض ${name} وإرسال الإيميل`);
} catch (emailErr) {
  console.error("Reject email error:", emailErr);
  showToast(`تم رفض ${name} لكن فشل إرسال الإيميل`);
}

closeDecisionModal();
await reload(false);
    }
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء تنفيذ العملية");
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.classList.remove("loading");
  }
});

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && $("#modalBackdrop").style.display === "flex"){
        closeDecisionModal();
      }
    });

    async function reload(showLoadingToast = false){
      try{
        if(showLoadingToast) showToast("جاري التحميل...");
        requests = await fetchPendingRequests();
        applyFilter();
      }catch(err){
        console.error(err);
        requests = [];
        filtered = [];
        render();
        showToast("تعذر تحميل الطلبات");
      }
    }

    reload(true);
