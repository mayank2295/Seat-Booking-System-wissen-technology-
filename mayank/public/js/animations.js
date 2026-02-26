/* ═══════════════════════════════════════════════════════════
   ANIMATIONS — Scroll Reveal · Counter · Confetti · Nav Scroll
   ═══════════════════════════════════════════════════════════ */

const Animations = (() => {
  /* ── Scroll Reveal (IntersectionObserver) ────────── */
  function initScrollReveal() {
    const els = document.querySelectorAll('.fade-in, .scale-in, .stagger');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    els.forEach((el) => observer.observe(el));
  }

  /* ── Animated Counters ──────────────────────────── */
  function initCounters() {
    const nums = document.querySelectorAll('.number-big[data-count]');
    if (!nums.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animateCounter(e.target);
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    nums.forEach((n) => observer.observe(n));
  }

  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease-out quart
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── Navbar Scroll Effect ───────────────────────── */
  function initNavScroll() {
    const nav = document.getElementById('landingNav');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle('scrolled', window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ── Confetti System ────────────────────────────── */
  function fireConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#0071e3', '#30d158', '#ff9f0a', '#ff3b30', '#40c8e0', '#bf5af2'];
    const particles = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 18,
        vy: Math.random() * -18 - 4,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.35,
        opacity: 1,
        decay: 0.012 + Math.random() * 0.008,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        if (p.opacity <= 0) return;
        alive = true;

        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;
        p.vx *= 0.99;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (alive) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    requestAnimationFrame(draw);
  }

  /* ── Public API ─────────────────────────────────── */
  return {
    initScrollReveal,
    initCounters,
    initNavScroll,
    fireConfetti,
  };
})();
