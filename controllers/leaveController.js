const LeaveModel = require('../models/leaveModel');
const BookingModel = require('../models/bookingModel');
const { isTeamDay, isWeekday } = require('../utils/weekHelper');

const leaveController = {
  async declareLeave(req, res) {
    try {
      const user = req.session.user;
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      if (!isWeekday(now)) {
        req.flash('error', 'Cannot declare leave on weekends.');
        return res.redirect('/dashboard');
      }

      if (!isTeamDay(user.batch, now)) {
        req.flash('error', 'You can only declare leave on your team days.');
        return res.redirect('/dashboard');
      }

      // If user has a booking for today, cancel it first
      const booking = await BookingModel.getUserBooking(user.id, today);
      if (booking) {
        await BookingModel.cancelBooking(booking.id, user.id);
      }

      await LeaveModel.declareLeave(user.id, today);
      req.flash('success', 'Leave declared for today. Your seat is now available for others.');
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Declare leave error:', err);
      req.flash('error', 'Failed to declare leave.');
      res.redirect('/dashboard');
    }
  },

  async cancelLeave(req, res) {
    try {
      const user = req.session.user;
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const cancelled = await LeaveModel.cancelLeave(user.id, today);

      if (cancelled) {
        req.flash('success', 'Leave cancelled. You can now book a seat.');
      } else {
        req.flash('error', 'No leave found to cancel.');
      }

      res.redirect('/dashboard');
    } catch (err) {
      console.error('Cancel leave error:', err);
      req.flash('error', 'Failed to cancel leave.');
      res.redirect('/dashboard');
    }
  }
};

module.exports = leaveController;
