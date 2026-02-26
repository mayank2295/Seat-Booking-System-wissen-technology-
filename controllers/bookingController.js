const BookingModel = require('../models/bookingModel');
const SeatModel = require('../models/seatModel');
const { isTeamDay, canBookFloating, isWeekday } = require('../utils/weekHelper');

const bookingController = {
  async bookSeat(req, res) {
    try {
      const user = req.session.user;
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Rule 1: No weekend booking
      if (!isWeekday(now)) {
        req.flash('error', 'Booking is not available on weekends.');
        return res.redirect('/dashboard');
      }

      // Rule 2: Check dynamic availability before proceeding
      const availability = await SeatModel.getAvailability(today);
      if (availability.available <= 0) {
        req.flash('error', 'No seats available. All 50 seats are booked.');
        return res.redirect('/dashboard');
      }

      const teamDay = isTeamDay(user.batch, now);

      // Rule 3: Non-active batch can only book after 3 PM
      if (!teamDay) {
        if (!canBookFloating(now)) {
          req.flash('error', 'You can book a floating seat only after 3:00 PM. Please try again later.');
          return res.redirect('/dashboard');
        }
      }

      // Rule 4: Book — transaction handles concurrency and double-booking
      const result = await BookingModel.bookSeat(user.id, today);

      if (result.success) {
        req.flash('success', result.message);
      } else {
        req.flash('error', result.message);
      }

      res.redirect('/dashboard');
    } catch (err) {
      console.error('Booking error:', err);
      req.flash('error', 'An error occurred while booking. Please try again.');
      res.redirect('/dashboard');
    }
  },

  async cancelBooking(req, res) {
    try {
      const user = req.session.user;
      const bookingId = req.body.bookingId;

      if (!bookingId) {
        req.flash('error', 'Invalid booking.');
        return res.redirect('/dashboard');
      }

      const cancelled = await BookingModel.cancelBooking(bookingId, user.id);

      if (cancelled) {
        req.flash('success', 'Booking cancelled. Seat is now available.');
      } else {
        req.flash('error', 'Could not cancel booking. It may already be cancelled.');
      }

      res.redirect('/dashboard');
    } catch (err) {
      console.error('Cancel error:', err);
      req.flash('error', 'An error occurred while cancelling. Please try again.');
      res.redirect('/dashboard');
    }
  }
};

module.exports = bookingController;
