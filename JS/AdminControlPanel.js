const API = {};

    const STORAGE_KEY = "admin_pending_requests_v1";
    let requests = [];
    let filtered = [];
    let pendingRejectId = null;

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

    async function fetchPendingRequests(){
      return seedIfEmpty();
    }

    async function acceptRequest(id){
      requests = requests.filter(r => r.id !== id);
      saveLocal();
    }

    async function rejectRequest(id, reason){
      requests = requests.filter(r => r.id !== id);
      saveLocal();

      const logKey = "admin_rejected_log_v1";
      const log = (()=>{ try { return JSON.parse(localStorage.getItem(logKey)||"[]"); } catch { return []; } })();
      log.unshift({ id, reason: reason || "", at: Date.now() });
      localStorage.setItem(logKey, JSON.stringify(log.slice(0,200)));
    }

    function render(){
      const list = $("#list");
      list.innerHTML = "";

      if(filtered.length === 0){
        $("#empty").style.display = "block";
      } else {
        $("#empty").style.display = "none";
      }

      for(const r of filtered){
        const created = new Date(r.createdAt || Date.now());
        const html = `
          <article class="card request-card" data-id="${escapeHtml(r.id)}">
            <div class="req-avatar" aria-hidden="true">${escapeHtml(initials(r.name))}</div>

            <div class="req-meta">
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

            <div class="req-actions">
              <button class="btn" type="button" data-action="accept" title="قبول الطلب" style="height:44px;">
                <i class="fa-solid fa-check" aria-hidden="true"></i>
                <span class="btn-label">قبول</span>
              </button>
              <button class="btn danger" type="button" data-action="reject" title="حذف/رفض الطلب مع سبب" style="height:44px;">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
                <span class="btn-label">حذف</span>
              </button>
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

    function openRejectModal(id){
      pendingRejectId = id;
      const r = requests.find(x => x.id === id);
      $("#modalSubtitle").textContent = r ? `الطلب: ${r.name} — ${r.email || ""}` : "—";
      $("#rejectReason").value = "";
      $("#modalBackdrop").style.display = "flex";
      $("#rejectReason").focus();
    }

    function closeRejectModal(){
      pendingRejectId = null;
      $("#modalBackdrop").style.display = "none";
    }

    $("#searchInput").addEventListener("input", applyFilter);

    $("#refreshBtn").addEventListener("click", async ()=>{
      await reload();
      showToast("تم التحديث");
    });

    $("#list").addEventListener("click", async (e)=>{
      const btn = e.target.closest("button[data-action]");
      if(!btn) return;
      const card = e.target.closest("[data-id]");
      const id = card?.getAttribute("data-id");
      if(!id) return;

      const action = btn.getAttribute("data-action");
      if(action === "accept"){
        btn.disabled = true;
        btn.classList.add("loading");
        try{
          await acceptRequest(id);
          showToast("تم قبول الطلب");
          await reload(false);
        }catch(err){
          console.error(err);
          showToast("حدث خطأ أثناء القبول");
          btn.disabled = false;
        }finally{
          btn.classList.remove("loading");
        }
      } else if(action === "reject"){
        openRejectModal(id);
      }
    });

    $("#closeModalBtn").addEventListener("click", closeRejectModal);
    $("#cancelRejectBtn").addEventListener("click", closeRejectModal);
    $("#modalBackdrop").addEventListener("click", (e)=>{
      if(e.target === $("#modalBackdrop")) closeRejectModal();
    });

    $("#confirmRejectBtn").addEventListener("click", async ()=>{
      const id = pendingRejectId;
      if(!id) return;

      const reason = $("#rejectReason").value.trim();
      const confirmBtn = $("#confirmRejectBtn");
      confirmBtn.disabled = true;
      confirmBtn.classList.add("loading");

      try{
        await rejectRequest(id, reason);
        closeRejectModal();
        showToast(reason ? "تم الحذف مع السبب" : "تم الحذف");
        await reload(false);
      }catch(err){
        console.error(err);
        showToast("حدث خطأ أثناء الحذف");
      }finally{
        confirmBtn.disabled = false;
        confirmBtn.classList.remove("loading");
      }
    });

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && $("#modalBackdrop").style.display === "flex"){
        closeRejectModal();
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
