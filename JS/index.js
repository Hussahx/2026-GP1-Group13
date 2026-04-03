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
     11. Contact Form – Full Validation
     ============================================================ */
  const contactForm = document.querySelector('.contact-form');

  if (contactForm) {

    // ── Helpers scoped to contact form ────────────────────────
    const cSetError = (field, msg) => {
      if (!field) return;
      let errEl = field.parentElement.querySelector('.c-field-error');
      if (!errEl) {
        errEl = document.createElement('small');
        errEl.className = 'c-field-error field-error';
        errEl.setAttribute('aria-live', 'polite');
        field.after(errEl);
      }
      if (msg) {
        field.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');
        errEl.textContent = msg;
      } else {
        field.classList.remove('is-invalid');
        field.setAttribute('aria-invalid', 'false');
        errEl.textContent = '';
      }
    };

    const cValidate = () => {
      let ok = true;

      const nameField  = contactForm.querySelector('#name');
      const emailField = contactForm.querySelector('#email');
      const msgField   = contactForm.querySelector('#message');

      const nameVal  = String(nameField?.value  || '').trim();
      const emailVal = String(emailField?.value || '').trim();
      const msgVal   = String(msgField?.value   || '').trim();

      if (!nameVal || nameVal.length < 2) {
        cSetError(nameField, 'الرجاء إدخال اسمك الكامل (حرفين على الأقل).');
        ok = false;
      } else {
        cSetError(nameField, '');
      }

      if (!emailVal) {
        cSetError(emailField, 'الرجاء إدخال بريدك الإلكتروني.');
        ok = false;
      } else if (!isValidEmail(emailVal)) {
        cSetError(emailField, 'الرجاء إدخال بريد إلكتروني صحيح.');
        ok = false;
      } else {
        cSetError(emailField, '');
      }

      if (!msgVal || msgVal.length < 10) {
        cSetError(msgField, 'الرجاء كتابة رسالتك (10 أحرف على الأقل).');
        ok = false;
      } else {
        cSetError(msgField, '');
      }

      if (!ok) {
        const firstInvalid = contactForm.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
      }

      return ok;
    };

    // ── Inline validation on blur ─────────────────────────────
    contactForm.addEventListener('blur', (e) => {
      const t = e.target;
      if (!['name', 'email', 'message'].includes(t.id)) return;
      cValidate();
    }, true);

    // ── Submit ────────────────────────────────────────────────
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!cValidate()) return;

      const btn = contactForm.querySelector('button[type="submit"]');
      if (!btn) return;

      // Show success state
      const original = btn.innerHTML;
      btn.innerHTML  = '<i class="fas fa-check-circle"></i> تم الإرسال بنجاح!';
      btn.style.background = 'linear-gradient(135deg, #7A9A7A, #4A7A56)';
      btn.disabled = true;

      // Show success message if element exists
      let successEl = contactForm.querySelector('.contact-success');
      if (!successEl) {
        successEl = document.createElement('div');
        successEl.className = 'contact-success form-success';
        successEl.innerHTML = `
          <div class="success-icon"><i class="fas fa-circle-check"></i></div>
          <div class="success-text">
            <strong>تم إرسال رسالتك بنجاح</strong>
            <span>شكرًا لتواصلك — سنرد عليك في أقرب وقت.</span>
          </div>`;
        contactForm.appendChild(successEl);
      }
      successEl.hidden = false;

      setTimeout(() => {
        contactForm.reset();
        // Clear all inline errors after reset
        contactForm.querySelectorAll('.c-field-error').forEach(el => { el.textContent = ''; });
        contactForm.querySelectorAll('.is-invalid').forEach(el => {
          el.classList.remove('is-invalid');
          el.setAttribute('aria-invalid', 'false');
        });
        successEl.hidden = true;
        btn.innerHTML  = original;
        btn.style.background = '';
        btn.disabled = false;
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

    // ✅ إرفاق المحضر إجباري
if (!rFile || !rFile.files.length) {
  ok = false;

  if (rFileErr)
    rFileErr.textContent =
      'الرجاء إرفاق صورة أو ملف المحضر.';
} else {

  const f = rFile.files[0];
  const max = 5 * 1024 * 1024;

  if (f.size > max) {
    ok = false;
    if (rFileErr)
      rFileErr.textContent =
        'حجم الملف يتجاوز 5MB.';
  } else {
    if (rFileErr)
      rFileErr.textContent = '';
  }
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

    if (rFileName) rFileName.textContent = 'اضغط لاختيار ملف (PDF، JPG، PNG)';
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

  if (!rFile.files.length) {
    if (rFileName)
      rFileName.textContent =
        'اضغط لاختيار ملف (PDF، JPG، PNG)';
    return;
  }

  const file = rFile.files[0];

  if (rFileName)
    rFileName.textContent = file.name;

});
  }

  if (reportForm) {

    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log("MODAL SUBMIT WORKING");

      const submitBtn = document.getElementById('submitReportBtn');

      const nameVal    = String(rName?.value    || '').trim();
      const contactVal = String(rContact?.value || '').trim();
      const locVal     = String(rLocation?.value || '').trim();
      const descVal    = String(rDesc?.value    || '').trim();
      const ageVal     = String(document.getElementById('rAge')?.value    || '').trim();
      const healthVal  = String(document.getElementById('rHealth')?.value || '').trim();
      const vehicleVal = String(document.getElementById('rVehicle')?.value|| '').trim();

      let ok = true;

      if (!nameVal || nameVal.length < 2) {
        setFieldError(rName, document.getElementById('rNameErr'), 'الرجاء إدخال الاسم (حرفين على الأقل).');
        ok = false;
      } else {
        setFieldError(rName, document.getElementById('rNameErr'), '');
      }

      if (!contactVal || !(isValidEmail(contactVal) || isValidSaudiPhone(contactVal))) {
        setFieldError(rContact, document.getElementById('rContactErr'), 'الرجاء إدخال بريد إلكتروني صحيح أو رقم سعودي بصيغة 05xxxxxxxx.');
        ok = false;
      } else {
        setFieldError(rContact, document.getElementById('rContactErr'), '');
      }

      if (!locVal) {
        setFieldError(rLocation, document.getElementById('rLocationErr'), 'الرجاء إدخال الموقع.');
        ok = false;
      } else {
        setFieldError(rLocation, document.getElementById('rLocationErr'), '');
      }

      if (!descVal || descVal.length < 10) {
        setFieldError(rDesc, document.getElementById('rDescErr'), 'الرجاء إدخال وصف البلاغ (10 أحرف على الأقل).');
        ok = false;
      } else {
        setFieldError(rDesc, document.getElementById('rDescErr'), '');
      }

      if (!ok) {
        const firstInvalid = reportForm.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      try {
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const { getFirestore, collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

        const firebaseConfig = {
          apiKey:            "AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0",
          authDomain:        "rasid-1bb06.firebaseapp.com",
          projectId:         "rasid-1bb06",
          storageBucket:     "rasid-1bb06.firebasestorage.app",
          messagingSenderId: "668525115587",
          appId:             "1:668525115587:web:e017be3b5cbf4ac3b30a76",
          measurementId:     "G-MZ3KB7WBK4"
        };

        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        const db  = getFirestore(app);

        const reportId = 'RASID-' + Math.floor(10000 + Math.random() * 90000);

        await addDoc(collection(db, 'Report'), {
          reportId,
          missingPersonName: nameVal,
          age:               ageVal,
          healthStatus:      healthVal,
          vehicle:           vehicleVal,
          location:          locVal,
          description:       descVal,
          contact:           contactVal,
          reportTime:        new Date(),
          status:"new"
        });

      } catch (err) {
        console.error('Firebase save error:', err);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      // Clear form + close modal
      reportForm.reset();
      if (rFile)     rFile.value = '';
      if (rFileName) rFileName.textContent = 'اضغط لاختيار ملف (PDF، JPG، PNG)';
      resetReportUI();
      closeModal(reportModal);

      if (submitBtn) submitBtn.disabled = false;

      // Show success banner in main page AFTER modal closes
      setTimeout(() => {
        const banner = document.getElementById('reportSuccessBanner');
        if (!banner) return;
        banner.style.opacity = '0';
        banner.style.display = 'flex';
        requestAnimationFrame(() => {
          banner.style.transition = 'opacity 0.4s ease';
          banner.style.opacity = '1';
        });
        setTimeout(() => {
          banner.style.opacity = '0';
          setTimeout(() => { banner.style.display = 'none'; }, 400);
        }, 4000);
      }, 300);

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

  const forgotLink = document.getElementById('forgotLink');

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

    // Default icon: fa-eye (password is hidden → show eye icon)
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

  // Forgot password link — completely independent from login form/validation
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      closeModal(loginModal);

      const forgotModal = document.getElementById('forgotModal');
      if (forgotModal) {
        // Dispatch custom event so forgot-flow engine resets state
        forgotModal.dispatchEvent(new CustomEvent('fg:open'));
        openModal(forgotModal, forgotLink, '#fgEmail');
      }
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

    loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginAttempted = true;

  const ok = validateLoginForm();
  if (!ok) return;

  const email = lEmail.value;
  const password = lPass.value;

  try {
    const { loginAndRedirect } = await import('../JS/firebase.js');

    const result = await loginAndRedirect(email, password);

    if (!result.success) {
      showToast("خطأ", result.error);
    }

  } catch (err) {
    console.error(err);
    showToast("خطأ", "فشل الاتصال بالنظام");
  }
});
  }

  /* ============================================================
     15. Forgot Password Modal – 3-Step Reset Flow
     ─────────────────────────────────────────────
     Step 1 → Email verification
     Step 2 → OTP (6-digit, 2-min expiry, 5-attempt lock)
     Step 3 → New password (strength + rules)
     ============================================================ */

  const forgotModal = document.getElementById('forgotModal');
  if (forgotModal) wireModalClose(forgotModal);

  /* ── DOM refs ──────────────────────────────────────────── */
  // Steps
  const fgDots  = [1, 2, 3].map(n => document.getElementById(`fgDot${n}`));
  const fgLines = forgotModal?.querySelectorAll('.fg-step-line');
  const fgPanels = {
    1:       document.getElementById('fgPanel1'),
    2:       document.getElementById('fgPanel2'),
    3:       document.getElementById('fgPanel3'),
    success: document.getElementById('fgPanelSuccess'),
  };

  // Step 1
  const fgFormEmail  = document.getElementById('fgFormEmail');
  const fgEmail      = document.getElementById('fgEmail');
  const fgEmailErr   = document.getElementById('fgEmailErr');
  const fgSendBtn    = document.getElementById('fgSendBtn');

  // Step 2
  const fgFormOtp      = document.getElementById('fgFormOtp');
  const fgOtp          = document.getElementById('fgOtp');
  const fgOtpErr       = document.getElementById('fgOtpErr');
  const fgEmailDisplay = document.getElementById('fgEmailDisplay');
  const fgTimerEl      = document.getElementById('fgTimer');
  const fgCountdownEl  = document.getElementById('fgCountdown');
  const fgResendBtn    = document.getElementById('fgResendBtn');
  const fgLockWarn     = document.getElementById('fgLockWarn');
  const fgAttemptsLeft = document.getElementById('fgAttemptsLeft');
  const fgVerifyBtn    = document.getElementById('fgVerifyBtn');
  const fgBackToEmail  = document.getElementById('fgBackToEmail');

  // Step 3
  const fgFormPassword = document.getElementById('fgFormPassword');
  const fgNewPass      = document.getElementById('fgNewPass');
  const fgNewPassErr   = document.getElementById('fgNewPassErr');
  const fgConfPass     = document.getElementById('fgConfPass');
  const fgConfPassErr  = document.getElementById('fgConfPassErr');
  const fgToggleNew    = document.getElementById('fgToggleNew');
  const fgToggleConf   = document.getElementById('fgToggleConf');
  const fgStrengthEl   = document.getElementById('fgStrength');
  const fgStrengthFill = document.getElementById('fgStrengthFill');
  const fgStrengthLbl  = document.getElementById('fgStrengthLabel');
  const fgSaveBtn      = document.getElementById('fgSaveBtn');

  /* ── State ─────────────────────────────────────────────── */
  const FG = {
    currentStep:   1,
    otp:           null,   // generated code (string)
    otpExpiry:     null,   // Date timestamp
    otpFailures:   0,
    otpLocked:     false,
    countdownId:   null,
    OTP_TTL_MS:    2 * 60 * 1000,   // 2 minutes
    MAX_ATTEMPTS:  5,
  };

  /* ── Helpers ───────────────────────────────────────────── */

  /** Set or clear an inline field error */
  const fgSetErr = (field, errEl, msg) => {
    if (!field || !errEl) return;
    if (msg) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
      errEl.textContent = msg;
    } else {
      field.classList.remove('is-invalid');
      field.setAttribute('aria-invalid', 'false');
      errEl.textContent = '';
    }
  };

  /** Generate a cryptographically random 6-digit OTP */
  const fgGenerateOtp = () => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(arr[0] % 900000 + 100000); // always 6 digits
  };

  /** Store a new OTP and reset expiry */
  const fgIssueOtp = () => {
    FG.otp       = fgGenerateOtp();
    FG.otpExpiry = Date.now() + FG.OTP_TTL_MS;
    // ── DEV hint (remove in production) ────────────────────
    const hint = document.getElementById('fgDevHint');
    if (hint) hint.querySelector('strong').textContent = FG.otp;
    // ───────────────────────────────────────────────────────
    console.info('[DEV] OTP issued:', FG.otp); // remove in production
  };

  /** Toggle password-type input visibility */
  const fgToggleEye = (inputEl, btnEl) => {
    if (!inputEl || !btnEl) return;
    const hidden = inputEl.type === 'password';
    inputEl.type = hidden ? 'text' : 'password';
    const icon = btnEl.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-eye',      hidden);
      icon.classList.toggle('fa-eye-slash', !hidden);
    }
    btnEl.setAttribute('aria-label', hidden ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  };

  /* ── Step navigation ───────────────────────────────────── */

  const fgShowPanel = (step) => {
    // Hide all panels
    Object.values(fgPanels).forEach(p => {
      if (p) p.classList.add('fg-panel--hidden');
    });

    // Show target panel
    const target = fgPanels[step] || fgPanels.success;
    if (target) {
      target.classList.remove('fg-panel--hidden');
    }

    // Update step dots
    fgDots.forEach((dot, i) => {
      if (!dot) return;
      const n = i + 1;
      dot.classList.remove('fg-step--active', 'fg-step--done');
      if (typeof step === 'number') {
        if (n < step)  dot.classList.add('fg-step--done');
        if (n === step) dot.classList.add('fg-step--active');
      }
    });

    // Update connector lines
    if (fgLines) {
      fgLines.forEach((line, i) => {
        if (typeof step === 'number') {
          line.classList.toggle('fg-step-line--done', i + 2 <= step);
        }
      });
    }

    FG.currentStep = step;

    // Focus first focusable element in new panel
    const focusable = target?.querySelector(
      'input:not([disabled]), button:not([disabled])'
    );
    if (focusable) setTimeout(() => focusable.focus(), 50);
  };

  /* ── Countdown timer ───────────────────────────────────── */

  const fgStopCountdown = () => {
    clearInterval(FG.countdownId);
    FG.countdownId = null;
  };

  const fgStartCountdown = (seconds = 60) => {
    fgStopCountdown();
    let remaining = seconds;

    const updateUI = () => {
      if (fgTimerEl)  fgTimerEl.textContent = remaining;
      if (fgResendBtn) fgResendBtn.disabled = remaining > 0;
      if (fgCountdownEl) fgCountdownEl.hidden = remaining <= 0;
    };

    updateUI();

    FG.countdownId = setInterval(() => {
      remaining -= 1;
      updateUI();
      if (remaining <= 0) fgStopCountdown();
    }, 1000);
  };

  /* ── Password strength checker ─────────────────────────── */

  const PASS_RULES = [
    { id: 'fgR8',   test: v => v.length >= 8 },
    { id: 'fgRUp',  test: v => /[A-Z]/.test(v) },
    { id: 'fgRLow', test: v => /[a-z]/.test(v) },
    { id: 'fgRNum', test: v => /\d/.test(v) },
    { id: 'fgRSpc', test: v => /[!@#$%^&*]/.test(v) },
  ];

  const STRENGTH_LEVELS = [
    { cls: '',               label: '' },
    { cls: 'fg-strength--weak',   label: 'ضعيفة' },
    { cls: 'fg-strength--fair',   label: 'مقبولة' },
    { cls: 'fg-strength--good',   label: 'جيدة' },
    { cls: 'fg-strength--strong', label: 'قوية' },
  ];

  const fgCheckStrength = (val) => {
    const passed = PASS_RULES.filter(r => r.test(val)).length;

    // Update rule checklist
    PASS_RULES.forEach(r => {
      const el = document.getElementById(r.id);
      if (!el) return;
      el.classList.toggle('fg-rule--ok', r.test(val));
    });

    // Update strength bar
    if (fgStrengthEl) {
      STRENGTH_LEVELS.forEach(l => fgStrengthEl.classList.remove(l.cls));
      const level = STRENGTH_LEVELS[passed <= 4 ? passed : 4];
      if (level.cls) fgStrengthEl.classList.add(level.cls);
      if (fgStrengthLbl) fgStrengthLbl.textContent = level.label;
    }

    return passed;
  };

  const isPasswordStrong = val => PASS_RULES.every(r => r.test(val));

  /* ── Full reset (called when modal closes) ─────────────── */

  const fgReset = () => {
    fgStopCountdown();
    FG.otp         = null;
    FG.otpExpiry   = null;
    FG.otpFailures = 0;
    FG.otpLocked   = false;

    // Reset all forms
    [fgFormEmail, fgFormOtp, fgFormPassword].forEach(f => f?.reset());

    // Clear errors
    [
      [fgEmail,   fgEmailErr],
      [fgOtp,     fgOtpErr],
      [fgNewPass, fgNewPassErr],
      [fgConfPass,fgConfPassErr],
    ].forEach(([f, e]) => fgSetErr(f, e, ''));

    // Reset OTP lock UI
    if (fgOtp) fgOtp.classList.remove('is-locked');
    if (fgLockWarn) fgLockWarn.hidden = true;

    // Reset strength meter + rules
    if (fgStrengthEl) {
      STRENGTH_LEVELS.forEach(l => fgStrengthEl.classList.remove(l.cls));
      if (fgStrengthLbl) fgStrengthLbl.textContent = '';
    }
    PASS_RULES.forEach(r => {
      const el = document.getElementById(r.id);
      if (el) el.classList.remove('fg-rule--ok');
    });

    // Reset password eye buttons
    [
      [fgNewPass, fgToggleNew],
      [fgConfPass, fgToggleConf],
    ].forEach(([inp, btn]) => {
      if (!inp || !btn) return;
      inp.type = 'password';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
      btn.setAttribute('aria-label', 'إظهار كلمة المرور');
    });

    // Back to step 1
    fgShowPanel(1);
  };

  /* ── Wire modal open/close ─────────────────────────────── */

  // Called from the forgotLink click handler (section 14)
  // We expose fgReset on the modal element for external callers
  if (forgotModal) {
    forgotModal.addEventListener('fg:open', () => fgReset());
  }

  /* ── Step 1: Email ─────────────────────────────────────── */

  if (fgFormEmail) {
    fgFormEmail.addEventListener('submit', (e) => {
      e.preventDefault();

      const val = String(fgEmail?.value || '').trim();

      if (!val) {
        fgSetErr(fgEmail, fgEmailErr, 'الرجاء إدخال بريدك الإلكتروني.');
        return;
      }
      if (!isValidEmail(val)) {
        fgSetErr(fgEmail, fgEmailErr, 'الرجاء إدخال بريد إلكتروني صحيح.');
        return;
      }
      fgSetErr(fgEmail, fgEmailErr, '');

      // Simulate sending OTP
      if (fgSendBtn) {
        fgSendBtn.disabled = true;
        fgSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الإرسال…';
      }

      setTimeout(() => {
        fgIssueOtp();
        FG.otpFailures = 0;
        FG.otpLocked   = false;

        if (fgEmailDisplay) fgEmailDisplay.textContent = val;
        if (fgSendBtn) {
          fgSendBtn.disabled = false;
          fgSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الرمز';
        }

        fgShowPanel(2);
        fgStartCountdown(60);
      }, 900); // simulated network delay
    });

    // Live validation on blur
    fgEmail?.addEventListener('blur', () => {
      const val = String(fgEmail.value || '').trim();
      if (!val) return; // don't nag on empty blur
      if (!isValidEmail(val)) {
        fgSetErr(fgEmail, fgEmailErr, 'الرجاء إدخال بريد إلكتروني صحيح.');
      } else {
        fgSetErr(fgEmail, fgEmailErr, '');
      }
    });
  }

  /* ── Step 2: OTP ───────────────────────────────────────── */

  // Only allow digits in OTP input
  fgOtp?.addEventListener('input', () => {
    fgOtp.value = fgOtp.value.replace(/\D/g, '').slice(0, 6);
  });

  // Resend button
  fgResendBtn?.addEventListener('click', () => {
    if (FG.otpLocked) return;
    fgIssueOtp();
    FG.otpFailures = 0;
    if (fgLockWarn) fgLockWarn.hidden = true;
    if (fgOtp) {
      fgOtp.value = '';
      fgOtp.classList.remove('is-locked');
    }
    fgSetErr(fgOtp, fgOtpErr, '');
    fgStartCountdown(60);
  });

  // Back to email
  fgBackToEmail?.addEventListener('click', () => {
    fgStopCountdown();
    fgSetErr(fgOtp, fgOtpErr, '');
    if (fgOtp) fgOtp.value = '';
    fgShowPanel(1);
  });

  if (fgFormOtp) {
    fgFormOtp.addEventListener('submit', (e) => {
      e.preventDefault();
      if (FG.otpLocked) return;

      const entered = String(fgOtp?.value || '').trim();

      // Basic format checks
      if (!entered) {
        fgSetErr(fgOtp, fgOtpErr, 'الرجاء إدخال رمز التحقق.');
        return;
      }
      if (!/^\d{6}$/.test(entered)) {
        fgSetErr(fgOtp, fgOtpErr, 'الرمز يجب أن يتكون من 6 أرقام فقط.');
        return;
      }

      // Expiry check
      if (Date.now() > FG.otpExpiry) {
        fgSetErr(fgOtp, fgOtpErr, 'انتهت صلاحية الرمز. الرجاء طلب رمز جديد.');
        fgStartCountdown(0); // reset timer UI
        return;
      }

      // Match check
      if (entered !== FG.otp) {
        FG.otpFailures += 1;
        const left = FG.MAX_ATTEMPTS - FG.otpFailures;

        if (FG.otpFailures >= FG.MAX_ATTEMPTS) {
          // Lock out
          FG.otpLocked = true;
          fgOtp.classList.add('is-locked');
          fgOtp.disabled = true;
          if (fgVerifyBtn) fgVerifyBtn.disabled = true;
          if (fgLockWarn) {
            fgLockWarn.hidden = false;
            const msg = fgLockWarn.querySelector('#fgLockMsg');
            if (msg) msg.innerHTML = 'تم قفل المحاولات. الرجاء طلب رمز جديد.';
          }
          fgSetErr(fgOtp, fgOtpErr, 'رمز التحقق خاطئ. تم قفل الحساب مؤقتًا.');
        } else {
          // Show warning with remaining attempts
          if (fgLockWarn && left <= 2) {
            fgLockWarn.hidden = false;
            if (fgAttemptsLeft) fgAttemptsLeft.textContent = left;
          }
          fgSetErr(fgOtp, fgOtpErr, `رمز التحقق غير صحيح. (${left} محاولات متبقية)`);
        }
        return;
      }

      // ✅ OTP correct
      fgStopCountdown();
      fgSetErr(fgOtp, fgOtpErr, '');
      if (fgLockWarn) fgLockWarn.hidden = true;
      fgShowPanel(3);
    });
  }

  /* ── Step 3: New Password ──────────────────────────────── */

  // Live strength + rules update
  fgNewPass?.addEventListener('input', () => {
    fgCheckStrength(fgNewPass.value);
    // Live clear confirm error if it was "doesn't match"
    if (fgConfPass?.value && fgConfPass.value === fgNewPass.value) {
      fgSetErr(fgConfPass, fgConfPassErr, '');
    }
  });

  // Eye toggles
  fgToggleNew?.addEventListener('click',  () => fgToggleEye(fgNewPass,  fgToggleNew));
  fgToggleConf?.addEventListener('click', () => fgToggleEye(fgConfPass, fgToggleConf));

  if (fgFormPassword) {
    fgFormPassword.addEventListener('submit', (e) => {
      e.preventDefault();

      const newVal  = String(fgNewPass?.value  || '');
      const confVal = String(fgConfPass?.value || '');
      let ok = true;

      // New password checks
      if (!newVal) {
        fgSetErr(fgNewPass, fgNewPassErr, 'الرجاء إدخال كلمة المرور الجديدة.');
        ok = false;
      } else if (!isPasswordStrong(newVal)) {
        fgSetErr(fgNewPass, fgNewPassErr, 'كلمة المرور لا تستوفي جميع الشروط المطلوبة.');
        ok = false;
      } else {
        fgSetErr(fgNewPass, fgNewPassErr, '');
      }

      // Confirm password checks
      if (!confVal) {
        fgSetErr(fgConfPass, fgConfPassErr, 'الرجاء تأكيد كلمة المرور.');
        ok = false;
      } else if (confVal !== newVal) {
        fgSetErr(fgConfPass, fgConfPassErr, 'كلمتا المرور غير متطابقتين.');
        ok = false;
      } else {
        fgSetErr(fgConfPass, fgConfPassErr, '');
      }

      if (!ok) return;

      // Simulate save
      if (fgSaveBtn) {
        fgSaveBtn.disabled = true;
        fgSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الحفظ…';
      }

      setTimeout(() => {
        // Clear sensitive data from memory
        FG.otp       = null;
        FG.otpExpiry = null;

        // Show success
        fgShowPanel('success');

        // Close modal after 2.8 s, then open login
        setTimeout(() => {
          closeModal(forgotModal);
          fgReset();
          // Offer user to log in
          showToast('تمت إعادة التعيين', 'يمكنك الآن تسجيل الدخول بكلمة مرورك الجديدة.');
        }, 2800);
      }, 1000);
    });
  }
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
