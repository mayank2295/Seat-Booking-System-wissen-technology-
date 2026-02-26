/* ═══════════════════════════════════════════════════════════
   AUTH — Login · Logout · Session Management
   (Adapted for MySQL backend — uses email/password)
   ═══════════════════════════════════════════════════════════ */

const Auth = (() => {
  const API = '';

  /* ── Session helpers ────────────────────────────── */
  function getSession() {
    const raw = sessionStorage.getItem('seatflow_user');
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(user) {
    sessionStorage.setItem('seatflow_user', JSON.stringify(user));
  }

  function clearSession() {
    sessionStorage.removeItem('seatflow_user');
  }

  function isLoggedIn() {
    return !!getSession();
  }

  /* ── Login ──────────────────────────────────────── */
  async function login(email, password) {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Login failed');

    setSession(data.employee);
    return data.employee;
  }

  /* ── Logout ─────────────────────────────────────── */
  function logout() {
    clearSession();
    // Also destroy server-side session (fire-and-forget)
    try { fetch('/api/logout', { method: 'POST' }).catch(() => {}); } catch (e) {}
  }

  /* ── Init login form ────────────────────────────── */
  function initLoginForm(onSuccess) {
    const form  = document.getElementById('loginForm');
    const btn   = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('empEmail').value.trim();
      const pass  = document.getElementById('empPass').value.trim();

      if (!email || !pass) {
        showLoginError('Please fill in all fields.');
        return;
      }

      btn.classList.add('loading');
      btn.innerHTML = '<span class="spinner"></span>';
      errEl.classList.remove('show');

      try {
        const user = await login(email, pass);
        if (onSuccess) onSuccess(user);
      } catch (err) {
        showLoginError(err.message);
      } finally {
        btn.classList.remove('loading');
        btn.textContent = 'Sign In';
      }
    });
  }

  function showLoginError(msg) {
    const errEl = document.getElementById('loginError');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.add('show');
  }

  /* ── Public API ─────────────────────────────────── */
  return {
    getSession,
    isLoggedIn,
    login,
    logout,
    clearSession,
    initLoginForm,
  };
})();
