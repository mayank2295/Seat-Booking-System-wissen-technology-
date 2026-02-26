const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { getWeekNumber, isTeamDay, canBookFloating, isWeekday } = require('../utils/weekHelper');

const TOTAL_SEATS = parseInt(process.env.TOTAL_SEATS) || 50;
const REGULAR_SEATS = 40;
const FLOATER_SEATS = 10;

// ═══════════════════════════════════════════════════════════════════════════
//  REAL-TIME: Server-Sent Events (SSE)
// ═══════════════════════════════════════════════════════════════════════════
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

const apiController = {
  // ─── SSE STREAM ────────────────────────────────────────────────────────
  stream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(':\n\n');
    sseClients.add(res);
    console.log(`[SSE] Client connected (${sseClients.size} total)`);

    req.on('close', () => {
      sseClients.delete(res);
      console.log(`[SSE] Client disconnected (${sseClients.size} total)`);
    });
  },

  // ─── POST /api/login ──────────────────────────────────────────────────
  async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      const user = rows[0];
      if (!user) {
        return res.status(401).json({ error: 'User not found. Check your email.' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }

      // Set server-side session (needed for admin EJS pages)
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        batch: user.batch,
        role: user.role,
      };

      res.json({
        success: true,
        employee: {
          id: user.id,
          name: user.name,
          batch: user.batch,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('API login error:', err);
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  },

  // ─── GET /api/seats?date=YYYY-MM-DD ───────────────────────────────────
  async getSeats(req, res) {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });

    try {
      const d = new Date(date + 'T00:00:00');
      const isWknd = d.getDay() === 0 || d.getDay() === 6;

      // Get all seats
      const [seats] = await pool.execute('SELECT * FROM seats ORDER BY id');

      // Get active bookings for date
      const [bookings] = await pool.execute(
        `SELECT b.seat_id, b.user_id
         FROM bookings b
         WHERE b.booking_date = ? AND b.status = 'booked'`,
        [date]
      );

      // Get cancelled (released) bookings for date
      const [cancelled] = await pool.execute(
        `SELECT b.seat_id
         FROM bookings b
         WHERE b.booking_date = ? AND b.status = 'cancelled'`,
        [date]
      );

      const bookedMap = {};
      bookings.forEach((b) => {
        bookedMap[b.seat_id] = b.user_id;
      });

      // Get leaves for this date — each leave from priority batch frees a potential regular seat
      const [leaves] = await pool.execute(
        `SELECT l.user_id FROM leaves l
         JOIN users u ON u.id = l.user_id
         WHERE l.leave_date = ?`,
        [date]
      );

      // Build set of cancelled seat IDs (released seats become temp floaters)
      const cancelledSet = new Set(cancelled.map(c => c.seat_id));

      const seatList = seats.map((s) => ({
        id: s.seat_number,
        type: s.id <= REGULAR_SEATS ? 'regular' : 'floater',
        floor: s.id <= 20 ? 1 : 2,
        booked: !!bookedMap[s.id],
        bookedBy: bookedMap[s.id] || null,
        tempFloater: cancelledSet.has(s.id),
      }));

      const weekNum = getWeekNumber(d);
      let owningBatch = null;
      if (!isWknd) {
        owningBatch = isTeamDay(1, d) ? 1 : 2;
      }

      const bookedRegular = bookings.filter((b) => {
        const seat = seats.find((s) => s.id === b.seat_id);
        return seat && seat.id <= REGULAR_SEATS;
      }).length;

      const bookedFloater = bookings.filter((b) => {
        const seat = seats.find((s) => s.id === b.seat_id);
        return seat && seat.id > REGULAR_SEATS;
      }).length;

      res.json({
        date,
        isWeekend: isWknd,
        owningBatch,
        weekNumber: weekNum,
        weekParity: weekNum,
        serverTime: new Date().toISOString(),
        seats: seatList,
        stats: {
          totalSeats: TOTAL_SEATS,
          regularSeats: REGULAR_SEATS,
          floaterSeats: FLOATER_SEATS,
          bookedRegular,
          bookedFloater,
          availableFloaters: FLOATER_SEATS - bookedFloater + cancelled.length,
          releasedSeats: cancelled.length,
          totalBooked: bookings.length,
          onLeave: leaves.length,
        },
      });
    } catch (err) {
      console.error('API seats error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── POST /api/book ───────────────────────────────────────────────────
  async bookSeat(req, res) {
    const { employeeId, seatId, date } = req.body;
    if (!employeeId || !seatId || !date) {
      return res.status(400).json({ error: 'employeeId, seatId, and date are required.' });
    }

    try {
      const bookDate = new Date(date + 'T00:00:00');
      const now = new Date();

      // No weekends
      if (!isWeekday(bookDate)) {
        return res.status(400).json({ error: 'Cannot book on weekends.' });
      }

      // Find user
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [employeeId]);
      if (!users.length) return res.status(404).json({ error: 'Employee not found.' });
      const user = users[0];

      // Find seat by seat_number
      const [seats] = await pool.execute('SELECT * FROM seats WHERE seat_number = ?', [seatId]);
      if (!seats.length) return res.status(404).json({ error: 'Seat not found.' });
      const seat = seats[0];

      const seatType = seat.id <= REGULAR_SEATS ? 'regular' : 'floater';
      const teamDay = isTeamDay(user.batch, bookDate);

      // Check if this regular seat is a temp floater (freed by leave or release)
      let isTempFloater = false;
      if (seatType === 'regular') {
        const [cancelledCheck] = await pool.execute(
          `SELECT id FROM bookings WHERE seat_id = ? AND booking_date = ? AND status = 'cancelled'`,
          [seat.id, date]
        );
        isTempFloater = cancelledCheck.length > 0;
      }

      // One seat per employee per day
      const [existing] = await pool.execute(
        `SELECT id FROM bookings WHERE user_id = ? AND booking_date = ? AND status = 'booked'`,
        [employeeId, date]
      );
      if (existing.length) {
        return res.status(400).json({ error: 'You already have a booking for this day.' });
      }

      // Cannot book if on leave
      const [onLeave] = await pool.execute(
        'SELECT id FROM leaves WHERE user_id = ? AND leave_date = ?',
        [employeeId, date]
      );
      if (onLeave.length) {
        return res.status(400).json({ error: 'You are on leave for this date. Cancel your leave first to book.' });
      }

      // Seat already taken
      const [seatTaken] = await pool.execute(
        `SELECT id FROM bookings WHERE seat_id = ? AND booking_date = ? AND status = 'booked'`,
        [seat.id, date]
      );
      if (seatTaken.length) {
        return res.status(400).json({ error: 'This seat is already booked by someone else.' });
      }

      // 3 PM cutoff: applies to permanent floaters always, and temp floaters on non-team days
      if (seatType === 'floater' || (!teamDay && isTempFloater)) {
        const cutoff = new Date(bookDate);
        cutoff.setDate(cutoff.getDate() - 1);
        cutoff.setHours(15, 0, 0, 0);
        if (now < cutoff) {
          return res.status(400).json({
            error: 'Floater seats can only be booked after 3:00 PM the day before.',
          });
        }
      }

      // Non-team day → can only book floater OR temp floater (freed by leave/release)
      if (!teamDay && seatType === 'regular' && !isTempFloater) {
        return res.status(400).json({
          error: "It's not your team day. You can only book a floater seat.",
        });
      }

      // Insert booking
      await pool.execute(
        'INSERT INTO bookings (user_id, seat_id, booking_date, status) VALUES (?, ?, ?, ?)',
        [employeeId, seat.id, date, 'booked']
      );

      broadcastSSE('booking', {
        action: 'booked',
        seatId,
        employeeId,
        date,
        timestamp: now.toISOString(),
      });

      res.json({ success: true, message: `Seat ${seatId} booked successfully!` });
    } catch (err) {
      console.error('API book error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── POST /api/release ────────────────────────────────────────────────
  async releaseSeat(req, res) {
    const { employeeId, date } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: 'employeeId and date are required.' });
    }

    try {
      // Get the seat info before releasing for the broadcast
      const [booking] = await pool.execute(
        `SELECT b.seat_id, s.seat_number
         FROM bookings b JOIN seats s ON s.id = b.seat_id
         WHERE b.user_id = ? AND b.booking_date = ? AND b.status = 'booked'`,
        [employeeId, date]
      );

      const [result] = await pool.execute(
        `UPDATE bookings SET status = 'cancelled'
         WHERE user_id = ? AND booking_date = ? AND status = 'booked'`,
        [employeeId, date]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'No active booking found.' });
      }

      const seatNumber = booking.length ? booking[0].seat_number : null;

      broadcastSSE('booking', {
        action: 'released',
        seatId: seatNumber,
        employeeId,
        date,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Seat released — now available as a temporary floater.',
      });
    } catch (err) {
      console.error('API release error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── GET /api/my-bookings?employeeId=X ────────────────────────────────
  async myBookings(req, res) {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ error: 'employeeId required' });

    try {
      const [rows] = await pool.execute(
        `SELECT b.id, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
                b.status, b.created_at, s.seat_number
         FROM bookings b
         JOIN seats s ON s.id = b.seat_id
         WHERE b.user_id = ?
         ORDER BY b.booking_date DESC`,
        [employeeId]
      );

      const bookings = rows.map((r) => ({
        id: r.id,
        date: r.booking_date,
        seatId: r.seat_number,
        employeeId: parseInt(employeeId),
        status: r.status === 'booked' ? 'booked' : 'released',
        bookedAt: r.created_at,
      }));

      res.json(bookings);
    } catch (err) {
      console.error('API my-bookings error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── GET /api/activity?limit=N ────────────────────────────────────────
  async activity(req, res) {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    try {
      const [rows] = await pool.execute(
        `SELECT b.user_id, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
                b.status, b.created_at, s.seat_number, u.name
         FROM bookings b
         JOIN seats s ON s.id = b.seat_id
         JOIN users u ON u.id = b.user_id
         ORDER BY b.created_at DESC
         LIMIT ${limit}`
      );

      const activity = rows.map((r) => ({
        action: r.status === 'booked' ? 'booked' : 'released',
        employeeId: r.name,
        seatId: r.seat_number,
        date: r.booking_date,
        timestamp: r.created_at,
      }));

      res.json(activity);
    } catch (err) {
      console.error('API activity error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── GET /api/schedule?date=YYYY-MM-DD ────────────────────────────────
  schedule(req, res) {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    const d = new Date(date + 'T00:00:00');
    const isWknd = d.getDay() === 0 || d.getDay() === 6;

    let owningBatch = null;
    if (!isWknd) {
      owningBatch = isTeamDay(1, d) ? 1 : 2;
    }

    res.json({
      date,
      isWeekend: isWknd,
      owningBatch,
      weekNumber: getWeekNumber(d),
      serverTime: new Date().toISOString(),
    });
  },

  // ─── POST /api/leave/declare ───────────────────────────────────────────
  async declareLeave(req, res) {
    const { employeeId, date } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: 'employeeId and date are required.' });
    }

    try {
      const d = new Date(date + 'T00:00:00');

      if (!isWeekday(d)) {
        return res.status(400).json({ error: 'Cannot declare leave on weekends.' });
      }

      // Check if user exists
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [employeeId]);
      if (!users.length) return res.status(404).json({ error: 'Employee not found.' });
      const user = users[0];

      // Check if it's their team day
      if (!isTeamDay(user.batch, d)) {
        return res.status(400).json({ error: 'You can only declare leave on your team days.' });
      }

      // Check if already on leave
      const [existingLeave] = await pool.execute(
        'SELECT id FROM leaves WHERE user_id = ? AND leave_date = ?',
        [employeeId, date]
      );
      if (existingLeave.length) {
        return res.status(400).json({ error: 'You have already declared leave for this date.' });
      }

      // If user has an active booking, cancel it → seat becomes temp floater
      const [booking] = await pool.execute(
        `SELECT b.id, b.seat_id, s.seat_number
         FROM bookings b JOIN seats s ON s.id = b.seat_id
         WHERE b.user_id = ? AND b.booking_date = ? AND b.status = 'booked'`,
        [employeeId, date]
      );

      if (booking.length) {
        await pool.execute(
          `UPDATE bookings SET status = 'cancelled' WHERE id = ?`,
          [booking[0].id]
        );

        broadcastSSE('booking', {
          action: 'released',
          seatId: booking[0].seat_number,
          employeeId,
          date,
          reason: 'leave',
          timestamp: new Date().toISOString(),
        });
      }

      // Insert leave record
      await pool.execute(
        'INSERT INTO leaves (user_id, leave_date) VALUES (?, ?)',
        [employeeId, date]
      );

      broadcastSSE('leave', {
        action: 'leave-declared',
        employeeId,
        date,
        freedSeat: booking.length ? booking[0].seat_number : null,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: booking.length
          ? `Leave declared. Your seat ${booking[0].seat_number} is now available as a floater.`
          : 'Leave declared successfully.',
        freedSeat: booking.length ? booking[0].seat_number : null,
      });
    } catch (err) {
      console.error('API leave declare error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── POST /api/leave/cancel ────────────────────────────────────────────
  async cancelLeave(req, res) {
    const { employeeId, date } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: 'employeeId and date are required.' });
    }

    try {
      const [result] = await pool.execute(
        'DELETE FROM leaves WHERE user_id = ? AND leave_date = ?',
        [employeeId, date]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'No leave found to cancel.' });
      }

      broadcastSSE('leave', {
        action: 'leave-cancelled',
        employeeId,
        date,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, message: 'Leave cancelled. You can now book a seat.' });
    } catch (err) {
      console.error('API leave cancel error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── GET /api/leave/status?employeeId=X&date=YYYY-MM-DD ───────────────
  async leaveStatus(req, res) {
    const { employeeId, date } = req.query;
    if (!employeeId || !date) {
      return res.status(400).json({ error: 'employeeId and date are required.' });
    }

    try {
      const [rows] = await pool.execute(
        'SELECT id FROM leaves WHERE user_id = ? AND leave_date = ?',
        [employeeId, date]
      );

      const [leaveCount] = await pool.execute(
        'SELECT COUNT(*) AS count FROM leaves WHERE leave_date = ?',
        [date]
      );

      res.json({
        onLeave: rows.length > 0,
        totalOnLeave: leaveCount[0].count,
      });
    } catch (err) {
      console.error('API leave status error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  },

  // ─── GET /api/time ────────────────────────────────────────────────────
  time(_req, res) {
    res.json({ serverTime: new Date().toISOString() });
  },
};

module.exports = apiController;
