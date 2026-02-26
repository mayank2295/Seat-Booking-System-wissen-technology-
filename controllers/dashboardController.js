const SeatModel = require('../models/seatModel');
const BookingModel = require('../models/bookingModel');
const LeaveModel = require('../models/leaveModel');
const { getWeekNumber, isTeamDay, canBookFloating, isWeekday, getBatchScheduleDescription } = require('../utils/weekHelper');

const dashboardController = {
  async getDashboard(req, res) {
    try {
      const user = req.session.user;
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

      const weekNumber = getWeekNumber(now);
      const teamDay = isTeamDay(user.batch, now);
      const weekday = isWeekday(now);
      const floatingAllowed = !teamDay && canBookFloating(now);

      // Dynamic availability: total 50, minus booked = available
      const availability = await SeatModel.getAvailability(today);

      const userBooking = await BookingModel.getUserBooking(user.id, today);
      const batchSchedule = getBatchScheduleDescription(user.batch, now);

      // Leave status
      const onLeave = await LeaveModel.hasLeave(user.id, today);
      const leaveCount = await LeaveModel.countByDate(today);

      res.render('dashboard', {
        title: 'Dashboard',
        user,
        weekNumber,
        teamDay,
        weekday,
        floatingAllowed,
        totalSeats: availability.total,
        bookedSeats: availability.booked,
        availableSeats: availability.available,
        userBooking,
        batchSchedule,
        today,
        currentHour: now.getHours(),
        onLeave,
        leaveCount
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      req.flash('error', 'Failed to load dashboard.');
      res.redirect('/login');
    }
  }
};

module.exports = dashboardController;
