const UserModel = require('../models/userModel');
const BookingModel = require('../models/bookingModel');
const SeatModel = require('../models/seatModel');
const LeaveModel = require('../models/leaveModel');
const { getWeekNumber, getBatchScheduleDescription } = require('../utils/weekHelper');

const adminController = {
  async getAdmin(req, res) {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const users = await UserModel.getAll();
      const bookings = await BookingModel.getBookingsByDate(today);
      const availability = await SeatModel.getAvailability(today);
      const leaves = await LeaveModel.getLeavesByDate(today);
      const weekNumber = getWeekNumber(now);
      const batch1Schedule = getBatchScheduleDescription(1, now);
      const batch2Schedule = getBatchScheduleDescription(2, now);

      res.render('admin', {
        title: 'Admin Panel',
        users,
        bookings,
        totalSeats: availability.total,
        bookedSeats: availability.booked,
        availableSeats: availability.available,
        leaves,
        leaveCount: leaves.length,
        weekNumber,
        batch1Schedule,
        batch2Schedule,
        today
      });
    } catch (err) {
      console.error('Admin panel error:', err);
      req.flash('error', 'Failed to load admin panel.');
      res.redirect('/login');
    }
  },

  async addUser(req, res) {
    try {
      const { name, email, password, batch } = req.body;

      if (!name || !email || !password || !batch) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/admin');
      }

      const batchNum = parseInt(batch);
      if (batchNum !== 1 && batchNum !== 2) {
        req.flash('error', 'Batch must be 1 or 2.');
        return res.redirect('/admin');
      }

      // Check if email exists
      const existing = await UserModel.findByEmail(email);
      if (existing) {
        req.flash('error', 'An employee with this email already exists.');
        return res.redirect('/admin');
      }

      await UserModel.create({ name, email, password, batch: batchNum });
      req.flash('success', `Employee ${name} added to Batch ${batchNum}.`);
      res.redirect('/admin');
    } catch (err) {
      console.error('Add user error:', err);
      req.flash('error', 'Failed to add employee.');
      res.redirect('/admin');
    }
  },

  async deleteUser(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        req.flash('error', 'Invalid user.');
        return res.redirect('/admin');
      }

      await UserModel.deleteById(userId);
      req.flash('success', 'Employee removed.');
      res.redirect('/admin');
    } catch (err) {
      console.error('Delete user error:', err);
      req.flash('error', 'Failed to remove employee.');
      res.redirect('/admin');
    }
  }
};

module.exports = adminController;
