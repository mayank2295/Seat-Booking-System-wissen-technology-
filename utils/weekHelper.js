/**
 * Week/Batch business logic helper.
 *
 * Rotation schedule (repeats every 2 weeks):
 *   Week 1: Batch 1 → Mon, Tue, Wed  |  Batch 2 → Thu, Fri
 *   Week 2: Batch 1 → Thu, Fri       |  Batch 2 → Mon, Tue, Wed
 *
 * WEEK_REF_DATE in .env must be a Monday that counts as Week 1 start.
 */

// Day-of-week constants (JS getDay(): 0=Sun … 6=Sat)
const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5;

/**
 * Get the rotation week number (1 or 2) for a given date.
 */
function getWeekNumber(date = new Date()) {
  const ref = new Date(process.env.WEEK_REF_DATE || '2026-01-05');
  ref.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffMs = target - ref;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeksElapsed = Math.floor(diffDays / 7);

  // Modulo 2 to alternate: 0 → Week 1, 1 → Week 2
  const mod = ((weeksElapsed % 2) + 2) % 2; // handles negative values
  return mod + 1; // returns 1 or 2
}

/**
 * Get the active batch(es) for a given date.
 * Returns { batch1Days: [...], batch2Days: [...] } for the current rotation week.
 */
function getSchedule(date = new Date()) {
  const week = getWeekNumber(date);

  if (week === 1) {
    return {
      batch1Days: [MON, TUE, WED],
      batch2Days: [THU, FRI]
    };
  } else {
    return {
      batch1Days: [THU, FRI],
      batch2Days: [MON, TUE, WED]
    };
  }
}

/**
 * Check if today is a team/office day for the given batch.
 */
function isTeamDay(batch, date = new Date()) {
  const dayOfWeek = date.getDay();
  const schedule = getSchedule(date);

  if (batch === 1) {
    return schedule.batch1Days.includes(dayOfWeek);
  } else if (batch === 2) {
    return schedule.batch2Days.includes(dayOfWeek);
  }
  return false;
}

/**
 * Check if a non-team-day user can book a floating seat (after 3 PM).
 */
function canBookFloating(date = new Date()) {
  return date.getHours() >= 15;
}

/**
 * Check if the given date is a weekday (Mon-Fri).
 */
function isWeekday(date = new Date()) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Get a human-readable day name.
 */
function getDayName(dayNum) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[dayNum];
}

/**
 * Get the schedule description for a batch in the current week.
 */
function getBatchScheduleDescription(batch, date = new Date()) {
  const schedule = getSchedule(date);
  const days = batch === 1 ? schedule.batch1Days : schedule.batch2Days;
  return days.map(d => getDayName(d)).join(', ');
}

module.exports = {
  getWeekNumber,
  getSchedule,
  isTeamDay,
  canBookFloating,
  isWeekday,
  getDayName,
  getBatchScheduleDescription
};
