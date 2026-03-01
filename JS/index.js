/* script.js */
/* ============================================================
   RASID – EYES OF THE DESERT
   Main JavaScript – Responsive + RTL aware
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ============================================================
     1. AOS – Animate On Scroll
     ============================================================ */
  AOS.init({
    duration: 700,
    once: true,
    offset: 60,
    easing: 'ease-out-cubic',
    disable: window.innerWidth < 480 ? true : false,
  });

  /* ============================================================
     2. Typed.js – Hero Subtitle
     ============================================================ */
  if (document.getElementById('typed-text')) {
    new Typed('#typed-text', {
      strings: [
        'كشف البشر بالذكاء الاصطناعي',
        'تحديد الإحداثيات لحظيًا',
        'مراقبة مباشرة بالدرون',
        'إنقاذ الأرواح في الصحراء',
      ],
      typeSpeed: 60,
      backSpeed: 35,
      backDelay: 1800,
      loop: true,
      cursorChar: '|',
      smartBackspace: true,
    });
  }

  /* ============================================================
     3. Swiper – Features Slider (RTL)
     ============================================================ */
  if (document.querySelector('.features-swiper')) {
    new Swiper('.features-swiper', {
      slidesPerView: 1,
      spaceBetween: 16,
      loop: true,
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
        dynamicBullets: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      autoplay: {
        delay: 3400,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      },
      breakpoints: {
        480: { slidesPerView: 1, spaceBetween: 16 },
        640: { slidesPerView: 2, spaceBetween: 20 },
        1024: { slidesPerView: 3, spaceBetween: 24 },
      },
      a11y: {
        prevSlideMessage: 'الشريحة السابقة',
        nextSlideMessage: 'الشريحة التالية',
      },
      watchOverflow: true,
      observer: true,
      observeParents: true,
    });
  }

  /* ============================================================
     4. Navbar – Scroll Effects & Active Section Highlight
     ============================================================ */
  const navbar      = document.getElementById('navbar');
  const sections    = document.querySelectorAll('section[id]');
  const navLinks    = document.querySelectorAll('.nav-link');
  const navHeight   = () => navbar ? navbar.offsetHeight : 64;

  const onScroll = () => {
    if (!navbar) return;

    navbar.classList.toggle('scrolled', window.scrollY > 50);

    let current = '';
    sections.forEach(section => {
      if (window.scrollY >= section.offsetTop - navHeight() - 20) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ============================================================
     5. Mobile Menu Toggle
     ============================================================ */
  const menuToggle = document.getElementById('menuToggle');
  const navLinksEl = document.getElementById('navLinks');

  const closeMenu = () => {
    if (!navLinksEl || !menuToggle) return;
    navLinksEl.classList.remove('open');
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'فتح القائمة');
    document.body.style.overflow = '';
  };

  const openMenu = () => {
    if (!navLinksEl || !menuToggle) return;
    navLinksEl.classList.add('open');
    menuToggle.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'إغلاق القائمة');
    if (window.innerWidth < 768) document.body.style.overflow = 'hidden';
  };

  if (menuToggle && navLinksEl) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navLinksEl.classList.contains('open');
      isOpen ? closeMenu() : openMenu();
    });

    navLinksEl.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', e => {
      if (
        navLinksEl.classList.contains('open') &&
        !navLinksEl.contains(e.target) &&
        !menuToggle.contains(e.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navLinksEl.classList.contains('open')) {
        closeMenu();
        menuToggle.focus();
      }
    });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth >= 768) closeMenu();
    }, 150);
  });

  /* ============================================================
     6. Smooth Scrolling (with navbar offset)
     ============================================================ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = navHeight() + 12;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
        closeMenu();
      }
    });
  });

  /* ============================================================
     7. Stats Counters
     ============================================================ */
  const animateCounter = el => {
    const target = parseInt(el.dataset.target, 10);
    if (isNaN(target)) return;
    const suffix   = el.dataset.suffix || '';
    const duration = 1600;
    const fps      = 60;
    const steps    = (duration / 1000) * fps;
    const increment = target / steps;
    let current    = 0;

    const update = () => {
      current += increment;
      if (current < target) {
        el.textContent = Math.round(current).toLocaleString('ar-SA') + suffix;
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString('ar-SA') + suffix;
      }
    };
    requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  document.querySelectorAll('.counter-value[data-target]').forEach(el => {
    counterObserver.observe(el);
  });

  /* ============================================================
     8. Timeline Line
     ============================================================ */
  const timelineLine    = document.getElementById('timelineLine');
  const timelineSection = document.querySelector('.how-it-works');
  const timeline        = document.querySelector('.timeline');

  if (timelineLine && timelineSection && timeline) {
    const timelineObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            timelineLine.style.height = timeline.offsetHeight + 'px';
          }
        });
      },
      { threshold: 0.15 }
    );
    timelineObserver.observe(timelineSection);
  }

  /* ============================================================
     9. Charts (kept as-is)
     ============================================================ */
  const isSmallScreen = () => window.innerWidth < 480;

  const lineCtx = document.getElementById('lineChart');
  if (lineCtx) {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const shortDays = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمس', 'جمع', 'سبت'];

    const lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: isSmallScreen() ? shortDays : days,
        datasets: [
          {
            label: 'عمليات الرصد',
            data: [38, 52, 44, 67, 71, 55, 83],
            borderColor: '#A67C52',
            backgroundColor: 'rgba(166, 124, 82, 0.10)',
            borderWidth: 2.5,
            pointBackgroundColor: '#A67C52',
            pointBorderColor: '#FAF6F0',
            pointBorderWidth: 2,
            pointRadius: isSmallScreen() ? 3 : 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.4,
          },
          {
            label: 'اكتشافات',
            data: [12, 19, 9, 24, 28, 18, 31],
            borderColor: '#8B6B47',
            backgroundColor: 'rgba(139, 107, 71, 0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#8B6B47',
            pointBorderColor: '#FAF6F0',
            pointBorderWidth: 2,
            pointRadius: isSmallScreen() ? 3 : 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: isSmallScreen() ? 1.4 : 2,
        plugins: {
          legend: {
            labels: {
              font: { family: 'Tajawal', size: isSmallScreen() ? 11 : 13 },
              color: '#7A6245',
              padding: isSmallScreen() ? 10 : 16,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            rtl: true,
            backgroundColor: '#2A1F12',
            titleFont: { family: 'Tajawal', size: 13 },
            bodyFont:  { family: 'Tajawal', size: 12 },
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            ticks: {
              font: { family: 'Tajawal', size: isSmallScreen() ? 10 : 12 },
              color: '#7A6245',
              maxRotation: 0,
            },
            grid: { color: 'rgba(166,124,82,0.09)' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { family: 'Tajawal', size: isSmallScreen() ? 10 : 12 },
              color: '#7A6245',
              maxTicksLimit: isSmallScreen() ? 4 : 6,
            },
            grid: { color: 'rgba(166,124,82,0.09)' },
          },
        },
      },
    });

    let chartResizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(chartResizeTimer);
      chartResizeTimer = setTimeout(() => {
        lineChart.options.aspectRatio = isSmallScreen() ? 1.4 : 2;
        lineChart.data.labels = isSmallScreen() ? shortDays : days;
        lineChart.update();
      }, 200);
    });
  }

  const doughnutCtx = document.getElementById('doughnutChart');
  if (doughnutCtx) {
    new Chart(doughnutCtx, {
      type: 'doughnut',
      data: {
        labels: ['جديد', 'قيد المعالجة', 'مغلق'],
        datasets: [
          {
            data: [42, 35, 23],
            backgroundColor: ['#C2A477', '#8B6B47', '#7A9A7A'],
            borderColor: ['#FAF6F0', '#FAF6F0', '#FAF6F0'],
            borderWidth: 3,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            backgroundColor: '#2A1F12',
            titleFont: { family: 'Tajawal', size: 13 },
            bodyFont:  { family: 'Tajawal', size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
      },
    });
  }

  /* ============================================================
     10. Hero Parallax
     ============================================================ */
  const heroIllustration = document.querySelector('.hero-illustration');
  const isTouchDevice = () => window.matchMedia('(hover: none)').matches;

  if (heroIllustration && !isTouchDevice()) {
    document.addEventListener('mousemove', e => {
      const x = (e.clientX / window.innerWidth  - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      heroIllustration.style.transform = `translate(${x * -0.35}px, ${y * -0.35}px)`;
    });

    document.addEventListener('mouseleave', () => {
      heroIllustration.style.transform = 'translate(0, 0)';
    });
  }

  /* ============================================================
     11. Contact Form – Simple Feedback
     ============================================================ */
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      if (!btn) return;
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> تم الإرسال بنجاح!';
      btn.style.background = 'linear-gradient(135deg, #7A9A7A, #4A7A56)';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
        btn.disabled = false;
        contactForm.reset();
      }, 3000);
    });
  }

  /* ============================================================
     12. Modal System (UX + ARIA + Focus trap + restore focus)
     ============================================================ */
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const modalStack = [];
  let bodyLockCount = 0;

  const setBodyLock = locked => {
    if (locked) {
      bodyLockCount += 1;
      document.body.style.overflow = 'hidden';
    } else {
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) document.body.style.overflow = '';
    }
  };

  const getFocusables = modal =>
    Array.from(modal.querySelectorAll(focusableSelector)).filter(el => el.offsetParent !== null);

  const openModal = (modal, triggerEl, firstFocusSel) => {
    if (!modal) return;

    modal.__lastFocus = triggerEl || document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setBodyLock(true);

    modalStack.push(modal);

    const first = firstFocusSel ? modal.querySelector(firstFocusSel) : null;
    const targetFocus = first || getFocusables(modal)[0] || modal.querySelector('[data-close="true"]');
    if (targetFocus) setTimeout(() => targetFocus.focus(), 30);
  };

  const closeModal = (modal) => {
    if (!modal) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    setBodyLock(false);

    const idx = modalStack.lastIndexOf(modal);
    if (idx >= 0) modalStack.splice(idx, 1);

    const backTo = modal.__lastFocus;
    if (backTo && typeof backTo.focus === 'function') {
      setTimeout(() => backTo.focus(), 0);
    }
  };

  const closeTopModal = () => {
    const top = modalStack[modalStack.length - 1];
    if (top) closeModal(top);
  };

  const trapFocus = (modal, e) => {
    if (!modal || !modal.classList.contains('is-open')) return;
    if (e.key !== 'Tab') return;

    const focusables = getFocusables(modal);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', e => {
    const top = modalStack[modalStack.length - 1];
    if (!top) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeTopModal();
      return;
    }
    trapFocus(top, e);
  });

  const wireModalClose = (modal) => {
    if (!modal) return;

    modal.addEventListener('click', e => {
      const target = e.target;
      const closeEl = target?.closest?.('[data-close="true"]');
      if (closeEl) closeModal(modal);
    });
  };

  /* Toast */
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  const showToast = (title, msg) => {
    if (!toastEl) return;
    clearTimeout(toastTimer);

    toastEl.innerHTML = `
      <div class="t-ico"><i class="fas fa-circle-check"></i></div>
      <div class="t-txt">
        <strong>${title}</strong>
        <span>${msg}</span>
      </div>
    `;
    toastEl.hidden = false;

    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
      toastEl.innerHTML = '';
    }, 2600);
  };

  /* ============================================================
     13. Report Modal: strict validation + file upload UI
     ============================================================ */
  const reportModal   = document.getElementById('reportModal');
  const reportForm    = document.getElementById('reportForm');
  const reportSuccess = document.getElementById('reportSuccess');

  const openReportBtn = document.getElementById('openReportModal');

  const rName     = document.getElementById('rName');
  const rContact  = document.getElementById('rContact');
  const rLocation = document.getElementById('rLocation');
  const rDesc     = document.getElementById('rDesc');

  const rFile     = document.getElementById('rFile');
  const rFileName = document.getElementById('rFileName');
  const rFileSize = document.getElementById('rFileSize');
  const rFileErr  = document.getElementById('rFileErr');

  const setFieldError = (field, errEl, msg) => {
    if (!field || !errEl) return;
    if (msg) {
      field.setAttribute('aria-invalid', 'true');
      field.classList.add('is-invalid');
      errEl.textContent = msg;
    } else {
      field.setAttribute('aria-invalid', 'false');
      field.classList.remove('is-invalid');
      errEl.textContent = '';
    }
  };

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  const isValidSaudiPhone = (v) => /^05\d{8}$/.test(String(v || '').trim());

  const validateReportForm = () => {
    let ok = true;

    const nameVal = String(rName?.value || '').trim();
    if (!nameVal || nameVal.length < 2) {
      ok = false;
      setFieldError(rName, document.getElementById('rNameErr'), 'الرجاء إدخال الاسم (حرفين على الأقل).');
    } else {
      setFieldError(rName, document.getElementById('rNameErr'), '');
    }

    const contactVal = String(rContact?.value || '').trim();
    if (!contactVal || !(isValidEmail(contactVal) || isValidSaudiPhone(contactVal))) {
      ok = false;
      setFieldError(
        rContact,
        document.getElementById('rContactErr'),
        'الرجاء إدخال بريد إلكتروني صحيح أو رقم سعودي بصيغة 05xxxxxxxx.'
      );
    } else {
      setFieldError(rContact, document.getElementById('rContactErr'), '');
    }

    const locVal = String(rLocation?.value || '').trim();
    if (!locVal) {
      ok = false;
      setFieldError(rLocation, document.getElementById('rLocationErr'), 'الرجاء إدخال الموقع.');
    } else {
      setFieldError(rLocation, document.getElementById('rLocationErr'), '');
    }

    const descVal = String(rDesc?.value || '').trim();
    if (!descVal || descVal.length < 10) {
      ok = false;
      setFieldError(rDesc, document.getElementById('rDescErr'), 'الرجاء إدخال وصف البلاغ (10 أحرف على الأقل).');
    } else {
      setFieldError(rDesc, document.getElementById('rDescErr'), '');
    }

    if (rFile && rFile.files && rFile.files[0]) {
      const f = rFile.files[0];
      const max = 5 * 1024 * 1024;
      if (f.size > max) {
        ok = false;
        if (rFileErr) rFileErr.textContent = 'حجم الملف يتجاوز 5MB. الرجاء اختيار ملف أصغر.';
      } else {
        if (rFileErr) rFileErr.textContent = '';
      }
    } else {
      if (rFileErr) rFileErr.textContent = '';
    }

    if (!ok) {
      const firstInvalid =
        reportForm?.querySelector('.is-invalid') ||
        reportForm?.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
    }

    return ok;
  };

  const resetReportUI = () => {
    if (reportSuccess) reportSuccess.hidden = true;

    [rName, rContact, rLocation, rDesc].forEach(f => {
      if (!f) return;
      f.setAttribute('aria-invalid', 'false');
      f.classList.remove('is-invalid');
    });

    const errIds = ['rNameErr', 'rContactErr', 'rLocationErr', 'rDescErr', 'rFileErr'];
    errIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });

    if (rFileName) rFileName.textContent = 'لم يتم اختيار ملف';
    if (rFileSize) rFileSize.textContent = '';
  };

  if (reportModal) wireModalClose(reportModal);

  if (openReportBtn && reportModal) {
    openReportBtn.addEventListener('click', () => {
      resetReportUI();
      if (reportForm) reportForm.reset();
      openModal(reportModal, openReportBtn, '#rName');

      // Make sure internal scroll starts from top
      const body = reportModal.querySelector('.modal-body');
      if (body) body.scrollTop = 0;
    });
  }

  if (rFile) {
    rFile.addEventListener('change', () => {
      if (!rFile.files || !rFile.files[0]) {
        if (rFileName) rFileName.textContent = 'لم يتم اختيار ملف';
        if (rFileSize) rFileSize.textContent = '';
        if (rFileErr) rFileErr.textContent = '';
        return;
      }

      const f = rFile.files[0];
      const sizeKB = (f.size / 1024);
      const sizeText = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${Math.round(sizeKB)} KB`;

      if (rFileName) rFileName.textContent = f.name;
      if (rFileSize) rFileSize.textContent = `(${sizeText})`;

      const max = 5 * 1024 * 1024;
      if (f.size > max) {
        if (rFileErr) rFileErr.textContent = 'حجم الملف يتجاوز 5MB. الرجاء اختيار ملف أصغر.';
      } else {
        if (rFileErr) rFileErr.textContent = '';
      }
    });
  }

  if (reportForm) {
    reportForm.addEventListener('blur', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!['rName', 'rContact', 'rLocation', 'rDesc'].includes(t.id)) return;
      validateReportForm();
    }, true);

    reportForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (reportSuccess) reportSuccess.hidden = true;

      const ok = validateReportForm();
      if (!ok) return;

      if (reportSuccess) reportSuccess.hidden = false;

      const submitBtn = document.getElementById('submitReportBtn');
      if (submitBtn) submitBtn.disabled = true;

      setTimeout(() => {
        if (reportForm) reportForm.reset();
        resetReportUI();
        closeModal(reportModal);
        if (submitBtn) submitBtn.disabled = false;
      }, 1800);
    });
  }

  /* ============================================================
     14. Login Modal: validation + toast + forgot inline + password toggle
     ============================================================ */
  const loginModal   = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginModal');
  const loginForm    = document.getElementById('loginForm');

  const lEmail = document.getElementById('lEmail');
  const lPass  = document.getElementById('lPass');

  // NEW: Forgot link + inline message
  const forgotLink = document.getElementById('forgotLink');
  const forgotInlineMsg = document.getElementById('forgotInlineMsg');

  // NEW: eye toggle inside password input group
  const toggleLoginPassword = document.getElementById('toggleLoginPassword');

  const resetLoginUI = () => {
    const set = (field, errId, msg) => setFieldError(field, document.getElementById(errId), msg);

    if (lEmail) {
      lEmail.setAttribute('aria-invalid', 'false');
      lEmail.classList.remove('is-invalid');
    }
    if (lPass) {
      lPass.setAttribute('aria-invalid', 'false');
      lPass.classList.remove('is-invalid');
      // Default: password HIDDEN
      lPass.type = 'password';
    }

    set(lEmail, 'lEmailErr', '');
    set(lPass,  'lPassErr', '');

    // Hide forgot message
    if (forgotInlineMsg) {
      forgotInlineMsg.hidden = true;
      forgotInlineMsg.classList.remove('is-visible');
    }

    // Default icon: fa-eye-slash (password is hidden → show slash)
    if (toggleLoginPassword) {
      const icon = toggleLoginPassword.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      }
      toggleLoginPassword.setAttribute('aria-label', 'إظهار كلمة المرور');
    }
  };

  const validateLoginForm = () => {
    let ok = true;

    const emailVal = String(lEmail?.value || '').trim();
    if (!emailVal) {
      ok = false;
      setFieldError(lEmail, document.getElementById('lEmailErr'), 'الرجاء إدخال البريد الإلكتروني.');
    } else if (!isValidEmail(emailVal)) {
      ok = false;
      setFieldError(lEmail, document.getElementById('lEmailErr'), 'الرجاء إدخال بريد إلكتروني صحيح.');
    } else {
      setFieldError(lEmail, document.getElementById('lEmailErr'), '');
    }

    const passVal = String(lPass?.value || '').trim();
    if (!passVal) {
      ok = false;
      setFieldError(lPass, document.getElementById('lPassErr'), 'الرجاء إدخال كلمة المرور.');
    } else {
      setFieldError(lPass, document.getElementById('lPassErr'), '');
    }

    if (!ok) {
      const firstInvalid =
        loginForm?.querySelector('.is-invalid') ||
        loginForm?.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
    }

    return ok;
  };

  if (loginModal) wireModalClose(loginModal);

  if (openLoginBtn && loginModal) {
    openLoginBtn.addEventListener('click', () => {
      loginAttempted = false;
      resetLoginUI();
      if (loginForm) loginForm.reset();
      openModal(loginModal, openLoginBtn, '#lEmail');
    });
  }

  // Track whether the user has attempted to submit the login form
  let loginAttempted = false;

  // Forgot password link: only show inline message if login was attempted
  if (forgotLink && forgotInlineMsg) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (loginAttempted) {
        forgotInlineMsg.hidden = false;
        forgotInlineMsg.classList.add('is-visible');
        // Scroll link into view smoothly
        forgotLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      // If not attempted yet: do nothing (link is inert)
    });
  }

  // Toggle password visibility (eye button)
  // Correct UX:
  //   fa-eye-slash = password hidden  → clicking reveals → switch to fa-eye + type=text
  //   fa-eye       = password visible → clicking hides  → switch to fa-eye-slash + type=password
  if (toggleLoginPassword && lPass) {
    toggleLoginPassword.addEventListener('click', () => {
      const isCurrentlyHidden = lPass.type === 'password';
      const icon = toggleLoginPassword.querySelector('i');

      if (isCurrentlyHidden) {
        // Reveal password
        lPass.type = 'text';
        if (icon) {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
        toggleLoginPassword.setAttribute('aria-label', 'إخفاء كلمة المرور');
      } else {
        // Hide password
        lPass.type = 'password';
        if (icon) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        }
        toggleLoginPassword.setAttribute('aria-label', 'إظهار كلمة المرور');
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('blur', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!['lEmail', 'lPass'].includes(t.id)) return;
      validateLoginForm();
    }, true);

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loginAttempted = true;
      const ok = validateLoginForm();
      if (!ok) {
        // After a failed attempt: allow forgot-link to reveal its message
        // (user can now click "نسيت كلمة المرور؟" to see the helper)
        return;
      }

      showToast('تم تسجيل الدخول بنجاح.', 'مرحبًا بك! يمكنك الآن الوصول إلى لوحة التحكم.');
      closeModal(loginModal);
      loginForm.reset();
      loginAttempted = false;
      resetLoginUI();
    });
  }

  /* ============================================================
     15. Dev overflow guard
     ============================================================ */
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const checkOverflow = () => {
      const docWidth = document.documentElement.scrollWidth;
      if (docWidth > window.innerWidth) {
        console.warn('⚠️ Horizontal overflow detected. Width:', docWidth, 'vs Viewport:', window.innerWidth);
      }
    };
    window.addEventListener('resize', checkOverflow, { passive: true });
    checkOverflow();
  }

});