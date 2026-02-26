/* ═══════════════════════════════════════════════════════════
   DASHBOARD — SSE · Seat Grid · Booking · Release · Stats
   (Adapted for MySQL backend — uses seat.type for routing)
   ═══════════════════════════════════════════════════════════ */

const Dashboard = (() => {
  const API = '';
  let sseSource = null;
  let sseActive = false;
  let sseReconnectTimer = null;
  let selectedDate = '';
  let dateListenerBound = false;

  /* ── Helpers ─────────────────────────────────────── */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function isWeekend(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* ── Init Dashboard ──────────────────────────────── */
  function init() {
    const user = Auth.getSession();
    if (!user) return;

    // User info
    document.getElementById('dashUserName').textContent = user.name;
    document.getElementById('dashUserBatch').textContent = 'Batch ' + user.batch;
    document.getElementById('dashAvatar').textContent = user.name.split(' ').map(w => w[0]).join('');
    document.getElementById('dashGreeting').textContent = `${greeting()}, ${user.name.split(' ')[0]}`;

    // Date picker
    const dateInput = document.getElementById('bookingDate');
    selectedDate = today();
    dateInput.value = selectedDate;
    if (!dateListenerBound) {
      dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        loadSeats();
      });
      dateListenerBound = true;
    }

    // Date subtitle
    const dateObj = new Date();
    document.getElementById('dashDate').textContent =
      dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Batch card
    document.getElementById('cardBatch').textContent = user.batch;

    // Load seats & activity
    loadSeats();
    loadActivity();
    loadLeaveStatus();
    connectSSE();
  }

  /* ── Load Seats ──────────────────────────────────── */
  async function loadSeats() {
    const user = Auth.getSession();
    if (!user) return;

    // Weekend check
    const weekendEl  = document.getElementById('weekendBlock');
    const sectionsEl = document.getElementById('seatSections');

    if (isWeekend(selectedDate)) {
      weekendEl.style.display = 'flex';
      sectionsEl.style.display = 'none';
      document.getElementById('bookingBanner').style.display = 'none';
      document.getElementById('statsPills').style.display = 'none';
      return;
    } else {
      weekendEl.style.display = 'none';
      sectionsEl.style.display = 'block';
      document.getElementById('bookingBanner').style.display = 'flex';
      document.getElementById('statsPills').style.display = 'flex';
    }

    try {
      const res = await fetch(`${API}/api/seats?date=${selectedDate}`);
      const data = await res.json();
      const seats = data.seats || [];
      renderSeats(seats, user);
      updateStats(seats, user);
      updateBanner(seats, user);

      // Update leave stats from server
      if (data.stats) {
        const onLeaveEl = document.getElementById('cardLeave');
        const pillLeave = document.getElementById('pillLeave');
        if (onLeaveEl) onLeaveEl.textContent = data.stats.onLeave || 0;
        if (pillLeave) pillLeave.textContent = data.stats.onLeave || 0;
      }
    } catch (err) {
      console.error('Failed to load seats:', err);
    }
  }

  /* ── Render Seats ────────────────────────────────── */
  function renderSeats(seats, user) {
    const gridRegular = document.getElementById('gridRegular');
    const gridFloater = document.getElementById('gridFloater');
    gridRegular.innerHTML = '';
    gridFloater.innerHTML = '';

    seats.forEach((seat) => {
      const el = document.createElement('div');
      el.className = 'seat';
      el.innerHTML = `<span class="seat-id">${seat.id}</span><span class="seat-status"></span>`;

      const statusSpan = el.querySelector('.seat-status');

      if (seat.bookedBy === user.id) {
        el.classList.add('my-seat');
        statusSpan.textContent = 'My Seat';
      } else if (seat.bookedBy) {
        el.classList.add('booked');
        statusSpan.textContent = 'Booked';
        el.title = `Booked by someone`;
      } else if (seat.tempFloater) {
        el.classList.add('temp-floater');
        statusSpan.textContent = 'Temp Float';
        el.addEventListener('click', () => bookSeat(seat.id));
      } else {
        el.classList.add('available');
        statusSpan.textContent = 'Open';
        el.addEventListener('click', () => bookSeat(seat.id));
      }

      // Route to correct grid based on seat type
      if (seat.type === 'floater') {
        gridFloater.appendChild(el);
      } else {
        gridRegular.appendChild(el);
      }
    });
  }

  /* ── Update Stats ────────────────────────────────── */
  function updateStats(seats, user) {
    const available = seats.filter(s => !s.bookedBy).length;
    const booked = seats.filter(s => !!s.bookedBy).length;
    const floaters = seats.filter(s => s.type === 'floater' && !s.bookedBy).length;

    document.getElementById('cardAvailable').textContent = available;
    document.getElementById('cardBooked').textContent = booked;

    // On Leave stat (from server stats)
    const onLeaveEl = document.getElementById('cardLeave');
    const pillLeave = document.getElementById('pillLeave');
    // We'll update these after seats load via stats
    if (onLeaveEl && seats._stats) {
      onLeaveEl.textContent = seats._stats.onLeave || 0;
    }

    document.getElementById('pillAvail').textContent = available;
    document.getElementById('pillBooked').textContent = booked;
    document.getElementById('pillFloater').textContent = floaters;
  }

  /* ── Update Booking Banner ──────────────────────── */
  function updateBanner(seats, user) {
    const banner = document.getElementById('bookingBanner');
    const text   = document.getElementById('bannerText');
    const mySeat = seats.find(s => s.bookedBy === user.id);

    // Remove old release button
    const oldBtn = banner.querySelector('.release-btn');
    if (oldBtn) oldBtn.remove();

    if (mySeat) {
      banner.className = 'booking-banner has-booking';
      text.textContent = `✅ You have seat ${mySeat.id} booked for ${selectedDate}`;

      const releaseBtn = document.createElement('button');
      releaseBtn.className = 'release-btn';
      releaseBtn.textContent = 'Release';
      releaseBtn.addEventListener('click', () => releaseSeat(mySeat.id));
      banner.appendChild(releaseBtn);
    } else {
      banner.className = 'booking-banner no-booking';
      text.textContent = 'You have not booked a seat for this date. Click an available seat to book.';
    }
  }

  /* ── Book Seat ───────────────────────────────────── */
  async function bookSeat(seatId) {
    const user = Auth.getSession();
    if (!user) return;

    try {
      const res = await fetch(`${API}/api/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.id, seatId, date: selectedDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        App.toast(data.error || 'Booking failed', 'err');
        return;
      }

      App.toast(`Seat ${seatId} booked successfully!`, 'ok');
      Animations.fireConfetti();

      // Animate booked seat
      const seatEl = [...document.querySelectorAll('.seat')].find(
        el => el.querySelector('.seat-id')?.textContent === seatId
      );
      if (seatEl) seatEl.classList.add('just-booked');

      loadSeats();
      loadActivity();
    } catch (err) {
      App.toast('Network error. Try again.', 'err');
    }
  }

  /* ── Release Seat ────────────────────────────────── */
  async function releaseSeat(seatId) {
    const user = Auth.getSession();
    if (!user) return;

    try {
      const res = await fetch(`${API}/api/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.id, date: selectedDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        App.toast(data.error || 'Release failed', 'err');
        return;
      }

      App.toast(`Seat ${seatId} released.`, 'info');
      loadSeats();
      loadActivity();
    } catch (err) {
      App.toast('Network error. Try again.', 'err');
    }
  }

  /* ── Load Activity ───────────────────────────────── */
  async function loadActivity() {
    try {
      const res = await fetch(`${API}/api/activity?limit=30`);
      const data = await res.json();
      const list = document.getElementById('activityList');
      list.innerHTML = '';

      (Array.isArray(data) ? data : []).forEach((a) => {
        const li = document.createElement('li');
        li.className = 'activity-item';
        const time = new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        li.innerHTML = `<span class="act-time">${time}</span><span class="act-text">${a.employeeId} ${a.action} seat ${a.seatId}</span>`;
        list.appendChild(li);
      });
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  }

  /* ── Load Leave Status ───────────────────────── */
  async function loadLeaveStatus() {
    const user = Auth.getSession();
    if (!user) return;

    const banner = document.getElementById('leaveBanner');
    const text = document.getElementById('leaveText');
    const btn = document.getElementById('leaveActionBtn');

    // Hide on weekends
    if (isWeekend(selectedDate)) {
      banner.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`${API}/api/leave/status?employeeId=${user.id}&date=${selectedDate}`);
      const data = await res.json();

      banner.style.display = 'flex';

      // Remove old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);

      if (data.onLeave) {
        banner.className = 'leave-banner on-leave';
        text.textContent = `You are on leave for ${selectedDate}`;
        newBtn.textContent = 'Cancel Leave';
        newBtn.className = 'leave-action-btn cancel';
        newBtn.addEventListener('click', () => cancelLeave());
      } else {
        banner.className = 'leave-banner not-on-leave';
        text.textContent = 'Going to be away? Declare leave to free your seat for others.';
        newBtn.textContent = 'Declare Leave';
        newBtn.className = 'leave-action-btn declare';
        newBtn.addEventListener('click', () => declareLeave());
      }
    } catch (err) {
      console.error('Failed to load leave status:', err);
      banner.style.display = 'none';
    }
  }

  /* ── Declare Leave ─────────────────────────── */
  async function declareLeave() {
    const user = Auth.getSession();
    if (!user) return;

    try {
      const res = await fetch(`${API}/api/leave/declare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.id, date: selectedDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        App.toast(data.error || 'Failed to declare leave', 'err');
        return;
      }

      App.toast(data.message, 'ok');
      loadSeats();
      loadActivity();
      loadLeaveStatus();
    } catch (err) {
      App.toast('Network error. Try again.', 'err');
    }
  }

  /* ── Cancel Leave ──────────────────────────── */
  async function cancelLeave() {
    const user = Auth.getSession();
    if (!user) return;

    try {
      const res = await fetch(`${API}/api/leave/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.id, date: selectedDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        App.toast(data.error || 'Failed to cancel leave', 'err');
        return;
      }

      App.toast(data.message, 'info');
      loadSeats();
      loadActivity();
      loadLeaveStatus();
    } catch (err) {
      App.toast('Network error. Try again.', 'err');
    }
  }

  /* ── SSE Connection ──────────────────────────────── */
  function connectSSE() {
    if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }
    if (sseSource) sseSource.close();

    sseActive = true;
    sseSource = new EventSource(`${API}/api/stream`);

    sseSource.addEventListener('booking', () => {
      loadSeats();
      loadActivity();
    });

    sseSource.addEventListener('leave', () => {
      loadSeats();
      loadActivity();
      loadLeaveStatus();
    });

    sseSource.onerror = () => {
      if (sseSource) sseSource.close();
      sseSource = null;
      if (sseActive) {
        sseReconnectTimer = setTimeout(connectSSE, 3000);
      }
    };
  }

  function disconnectSSE() {
    sseActive = false;
    if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }
  }

  /* ── Public API ─────────────────────────────────── */
  return {
    init,
    loadSeats,
    disconnectSSE,
  };
})();
