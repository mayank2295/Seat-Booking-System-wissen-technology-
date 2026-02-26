const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const DATA_FILE = path.join(__dirname, "data.json");
const TOTAL_SEATS = 50;
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

app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(":\n\n"); // SSE comment to establish connection

  sseClients.add(res);
  console.log(`[SSE] Client connected (${sseClients.size} total)`);

  req.on("close", () => {
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected (${sseClients.size} total)`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  DATA STORE
// ═══════════════════════════════════════════════════════════════════════════
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  }
  const data = getDefaultData();
  saveData(data);
  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getDefaultData() {
  const employees = [];
  for (let i = 1; i <= 80; i++) {
    const batch = i <= 40 ? 1 : 2;
    employees.push({
      id: `EMP${String(i).padStart(3, "0")}`,
      name: `Employee ${i}`,
      batch,
      email: `emp${i}@seatflow.io`,
    });
  }

  const seats = [];
  for (let i = 1; i <= REGULAR_SEATS; i++) {
    seats.push({
      id: `R${String(i).padStart(2, "0")}`,
      type: "regular",
      floor: i <= 20 ? 1 : 2,
    });
  }
  for (let i = 1; i <= FLOATER_SEATS; i++) {
    seats.push({
      id: `F${String(i).padStart(2, "0")}`,
      type: "floater",
      floor: 1,
    });
  }

  return { employees, seats, bookings: [], activityLog: [] };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function weekParity(d) {
  return getWeekNumber(d) % 2 === 1 ? 1 : 2;
}

/**
 * Batch rotation:
 *   Odd weeks  → Batch 1: Mon–Wed, Batch 2: Thu–Fri
 *   Even weeks → Batch 2: Mon–Wed, Batch 1: Thu–Fri
 */
function batchForDay(date) {
  const dow = date.getDay();
  const parity = weekParity(date);
  if (parity === 1) {
    return dow >= 1 && dow <= 3 ? 1 : 2;
  } else {
    return dow >= 1 && dow <= 3 ? 2 : 1;
  }
}

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function addActivity(data, action, employeeId, seatId, date) {
  data.activityLog.unshift({
    action,
    employeeId,
    seatId,
    date,
    timestamp: new Date().toISOString(),
  });
  // Keep last 200 entries
  if (data.activityLog.length > 200) data.activityLog.length = 200;
}

// ═══════════════════════════════════════════════════════════════════════════
//  API: AUTH
// ═══════════════════════════════════════════════════════════════════════════
app.post("/api/login", (req, res) => {
  const { employeeId, password } = req.body;
  if (!employeeId || !password)
    return res.status(400).json({ error: "Employee ID and password are required." });

  const data = loadData();
  const emp = data.employees.find(
    (e) => e.id === employeeId.toUpperCase().trim()
  );
  if (!emp)
    return res.status(401).json({ error: "Employee not found. Check your ID." });

  const num = parseInt(employeeId.replace(/\D/g, ""), 10);
  if (password !== `pass${num}` && password !== "seatflow2026")
    return res.status(401).json({ error: "Incorrect password." });

  res.json({
    success: true,
    employee: { id: emp.id, name: emp.name, batch: emp.batch, email: emp.email },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: REAL-TIME SEAT DATA
// ═══════════════════════════════════════════════════════════════════════════
app.get("/api/seats", (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date query param is required" });

  const data = loadData();
  const d = new Date(date + "T00:00:00");

  const dayBookings = data.bookings.filter(
    (b) => b.date === date && b.status === "booked"
  );
  const releasedBookings = data.bookings.filter(
    (b) => b.date === date && b.status === "released"
  );

  const bookedMap = {};
  dayBookings.forEach((b) => {
    bookedMap[b.seatId] = b.employeeId;
  });

  const seats = data.seats.map((s) => ({
    id: s.id,
    type: s.type,
    floor: s.floor,
    booked: !!bookedMap[s.id],
    bookedBy: bookedMap[s.id] || null,
  }));

  const usedFloaters = dayBookings.filter(
    (b) => data.seats.find((s) => s.id === b.seatId)?.type === "floater"
  ).length;
  const extraFloaters = releasedBookings.length;

  const weekend = isWeekend(d);
  const owningBatch = weekend ? null : batchForDay(d);
  const wk = getWeekNumber(d);

  res.json({
    date,
    isWeekend: weekend,
    owningBatch,
    weekNumber: wk,
    weekParity: weekParity(d),
    serverTime: new Date().toISOString(),
    seats,
    stats: {
      totalSeats: TOTAL_SEATS,
      regularSeats: REGULAR_SEATS,
      floaterSeats: FLOATER_SEATS,
      bookedRegular: dayBookings.filter(
        (b) => data.seats.find((s) => s.id === b.seatId)?.type === "regular"
      ).length,
      bookedFloater: usedFloaters,
      availableFloaters: FLOATER_SEATS - usedFloaters + extraFloaters,
      releasedSeats: extraFloaters,
      totalBooked: dayBookings.length,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: BOOK SEAT
// ═══════════════════════════════════════════════════════════════════════════
app.post("/api/book", (req, res) => {
  const { employeeId, seatId, date } = req.body;
  if (!employeeId || !seatId || !date)
    return res.status(400).json({ error: "employeeId, seatId, and date are required." });

  const data = loadData();
  const bookDate = new Date(date + "T00:00:00");
  const now = new Date();

  // Rule: No weekends
  if (isWeekend(bookDate))
    return res.status(400).json({ error: "Cannot book on weekends." });

  const employee = data.employees.find((e) => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: "Employee not found." });

  const seat = data.seats.find((s) => s.id === seatId);
  if (!seat) return res.status(404).json({ error: "Seat not found." });

  // Rule: One seat per employee per day
  const existing = data.bookings.find(
    (b) => b.date === date && b.employeeId === employeeId && b.status === "booked"
  );
  if (existing)
    return res.status(400).json({ error: "You already have a booking for this day." });

  // Rule: Seat already taken
  const seatTaken = data.bookings.find(
    (b) => b.date === date && b.seatId === seatId && b.status === "booked"
  );
  if (seatTaken)
    return res.status(400).json({ error: "This seat is already booked by someone else." });

  const owningBatch = batchForDay(bookDate);
  const isTeamDay = employee.batch === owningBatch;

  // Rule: Floater time restriction — only after 3 PM the day before
  if (seat.type === "floater" || !isTeamDay) {
    const cutoff = new Date(bookDate);
    cutoff.setDate(cutoff.getDate() - 1);
    cutoff.setHours(15, 0, 0, 0);
    if (now < cutoff) {
      return res.status(400).json({
        error: "Floater seats can only be booked after 3:00 PM the day before.",
      });
    }
  }

  // Rule: Non-team day → floater only
  if (!isTeamDay && seat.type === "regular") {
    return res.status(400).json({
      error: "It's not your team day. You can only book a floater seat.",
    });
  }

  // Rule: Check floater availability
  if (seat.type === "floater") {
    const dayBookings = data.bookings.filter(
      (b) => b.date === date && b.status === "booked"
    );
    const usedFloaters = dayBookings.filter(
      (b) => data.seats.find((s) => s.id === b.seatId)?.type === "floater"
    ).length;
    const released = data.bookings.filter(
      (b) => b.date === date && b.status === "released"
    ).length;
    if (usedFloaters >= FLOATER_SEATS + released) {
      return res.status(400).json({ error: "No floater seats available." });
    }
  }

  const booking = {
    id: `BK${Date.now()}`,
    date,
    seatId,
    employeeId,
    type: seat.type,
    status: "booked",
    bookedAt: now.toISOString(),
  };
  data.bookings.push(booking);
  addActivity(data, "booked", employeeId, seatId, date);
  saveData(data);

  // ── Broadcast real-time update ──
  broadcastSSE("booking", {
    action: "booked",
    seatId,
    employeeId,
    date,
    timestamp: now.toISOString(),
  });

  res.json({ success: true, message: `Seat ${seatId} booked successfully!`, booking });
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: RELEASE SEAT
// ═══════════════════════════════════════════════════════════════════════════
app.post("/api/release", (req, res) => {
  const { employeeId, date } = req.body;
  if (!employeeId || !date)
    return res.status(400).json({ error: "employeeId and date are required." });

  const data = loadData();
  const idx = data.bookings.findIndex(
    (b) => b.date === date && b.employeeId === employeeId && b.status === "booked"
  );
  if (idx === -1)
    return res.status(404).json({ error: "No active booking found." });

  const seatId = data.bookings[idx].seatId;
  data.bookings[idx].status = "released";
  data.bookings[idx].releasedAt = new Date().toISOString();
  addActivity(data, "released", employeeId, seatId, date);
  saveData(data);

  // ── Broadcast real-time update ──
  broadcastSSE("booking", {
    action: "released",
    seatId,
    employeeId,
    date,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: "Seat released — now available as a temporary floater.",
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: MY BOOKINGS (all past & future)
// ═══════════════════════════════════════════════════════════════════════════
app.get("/api/my-bookings", (req, res) => {
  const { employeeId } = req.query;
  if (!employeeId)
    return res.status(400).json({ error: "employeeId required" });

  const data = loadData();
  const mine = data.bookings
    .filter((b) => b.employeeId === employeeId)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
  res.json(mine);
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════
app.get("/api/activity", (req, res) => {
  const data = loadData();
  const limit = parseInt(req.query.limit) || 20;
  res.json(data.activityLog.slice(0, limit));
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: SCHEDULE INFO
// ═══════════════════════════════════════════════════════════════════════════
app.get("/api/schedule", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });
  const d = new Date(date + "T00:00:00");
  res.json({
    date,
    isWeekend: isWeekend(d),
    owningBatch: isWeekend(d) ? null : batchForDay(d),
    weekNumber: getWeekNumber(d),
    weekParity: weekParity(d),
    serverTime: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  API: SERVER TIME (for clock sync)
// ═══════════════════════════════════════════════════════════════════════════
app.get("/api/time", (_req, res) => {
  res.json({ serverTime: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FALLBACK
// ═══════════════════════════════════════════════════════════════════════════
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  SeatFlow running at http://localhost:${PORT}\n`);
});
