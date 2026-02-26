/**
 * Week/Batch business logic helper.
 *
 * FIXED schedule (same every week, no rotation):
 *   Batch 1 → Mon, Tue, Wed
 *   Batch 2 → Thu, Fri
 */

// Day-of-week constants (JS getDay(): 0=Sun … 6=Sat)
const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5;

/**
 * Get the week number — always returns 1 since schedule is fixed.
 */
function getWeekNumber(date = new Date()) {
  return 1;
}

/**
 * Get the fixed schedule.
 * Batch 1 always works Mon, Tue, Wed.
 * Batch 2 always works Thu, Fri.
 */
function getSchedule(date = new Date()) {
  return {
    batch1Days: [MON, TUE, WED],
    batch2Days: [THU, FRI]
  };
}

/**
 * Check if today is a team/office day for the given batch.
 */
function isTeamDay(batch, date = new Date()) {
  const dayOfWeek = date.getDay();

  if (batch === 1) {
    return [MON, TUE, WED].includes(dayOfWeek);
  } else if (batch === 2) {
    return [THU, FRI].includes(dayOfWeek);
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
