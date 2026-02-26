/* ═══════════════════════════════════════════════════════════
   APP — Main Entry · SPA Routing · Toast · Init
   ═══════════════════════════════════════════════════════════ */

const App = (() => {
  const views = {
    landing:   document.getElementById('viewLanding'),
    login:     document.getElementById('viewLogin'),
    dashboard: document.getElementById('viewDashboard'),
  };

  const transition = document.getElementById('pageTransition');

  /* ── View Navigation ─────────────────────────────── */
  function navigate(viewName, instant = false) {
    const target = views[viewName];
    if (!target) return;

    if (instant) {
      Object.values(views).forEach(v => v.classList.remove('active'));
      target.classList.add('active');
      window.scrollTo(0, 0);
      return;
    }

    // Animate transition
    transition.classList.add('active');

    setTimeout(() => {
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

      setTimeout(() => transition.classList.remove('active'), 50);
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
      toast(`Welcome, ${user.name}!`, 'ok');
      navigate('dashboard');
    });

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Dashboard.disconnectSSE();
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
