/* ═══════════════════════════════════════════════════════════
   APP — Main Entry · SPA Routing · Toast · Init
   (Adapted: admin role redirects to /admin EJS page)
   ═══════════════════════════════════════════════════════════ */

const App = (() => {
  const views = {
    landing:   document.getElementById('viewLanding'),
    login:     document.getElementById('viewLogin'),
    dashboard: document.getElementById('viewDashboard'),
  };

  const transition = document.getElementById('pageTransition');
  let navTimer = null;
  let navBusy = false;

  /* ── View Navigation ─────────────────────────────── */
  function navigate(viewName, instant = false) {
    const target = views[viewName];
    if (!target) return;

    // Cancel any in-flight navigation
    if (navTimer) { clearTimeout(navTimer); navTimer = null; }
    transition.classList.remove('active');
    navBusy = false;

    if (instant) {
      Object.values(views).forEach(v => v.classList.remove('active'));
      target.classList.add('active');
      window.scrollTo(0, 0);
      return;
    }

    // Prevent overlapping transitions
    if (navBusy) return;
    navBusy = true;

    // Animate transition
    transition.classList.add('active');

    navTimer = setTimeout(() => {
      try {
        Object.values(views).forEach(v => v.classList.remove('active'));
        target.classList.add('active');
        window.scrollTo(0, 0);

        // Init view-specific logic
        if (viewName === 'landing') {
          Animations.initScrollReveal();
          Animations.initCounters();
          Animations.initNavScroll();
        }
        if (viewName === 'dashboard') {
          Dashboard.init();
        }
      } catch (err) {
        console.error('Navigation error:', err);
      } finally {
        navBusy = false;
        navTimer = setTimeout(() => { transition.classList.remove('active'); navTimer = null; }, 50);
      }
    }, 350);
  }

  /* ── Toast ───────────────────────────────────────── */
  function toast(message, type = 'ok') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast ${type}`;

    requestAnimationFrame(() => {
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3000);
    });
  }

  /* ── Wire Up Buttons ─────────────────────────────── */
  function bindEvents() {
    // Landing → Login
    const navLogin     = document.getElementById('navLoginBtn');
    const heroStart    = document.getElementById('heroGetStarted');
    const ctaStart     = document.getElementById('ctaGetStarted');
    const backToLanding = document.getElementById('backToLanding');
    const logoutBtn    = document.getElementById('logoutBtn');

    if (navLogin)  navLogin.addEventListener('click',  (e) => { e.preventDefault(); navigate('login'); });
    if (heroStart) heroStart.addEventListener('click',  () => navigate('login'));
    if (ctaStart)  ctaStart.addEventListener('click',   () => navigate('login'));

    // Login → Landing
    if (backToLanding) backToLanding.addEventListener('click', () => navigate('landing'));

    // Login form
    Auth.initLoginForm((user) => {
      // If admin, redirect to EJS admin panel
      if (user.role === 'admin') {
        window.location.href = '/admin';
        return;
      }

      toast(`Welcome, ${user.name}!`, 'ok');
      navigate('dashboard');
    });

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        try {
          Dashboard.disconnectSSE();
        } catch (e) { console.warn('SSE disconnect error:', e); }
        Auth.logout();
        toast('Signed out successfully.', 'info');
        navigate('landing');
      });
    }
  }

  /* ── Boot ────────────────────────────────────────── */
  function boot() {
    bindEvents();

    // Check session → auto-navigate
    if (Auth.isLoggedIn()) {
      const user = Auth.getSession();
      // Admin should go to /admin — but only if server session is valid
      if (user.role === 'admin') {
        // Verify server session is alive before redirecting
        fetch('/api/time', { credentials: 'same-origin' })
          .then(() => { window.location.href = '/admin'; })
          .catch(() => {
            // Server session expired — clean up and show landing
            Auth.logout();
            Animations.initScrollReveal();
            Animations.initCounters();
            Animations.initNavScroll();
          });
        return;
      }
      navigate('dashboard', true);
      Dashboard.init();
    } else {
      // Init landing animations
      Animations.initScrollReveal();
      Animations.initCounters();
      Animations.initNavScroll();
    }
  }

  // Auto-start
  document.addEventListener('DOMContentLoaded', boot);

  /* ── Public API ─────────────────────────────────── */
  return { navigate, toast };
})();
