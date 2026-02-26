const pool = require('../config/db');

const TOTAL_SEATS = parseInt(process.env.TOTAL_SEATS) || 50;

const SeatModel = {
  /**
   * Dynamic availability: TOTAL_SEATS minus booked count for the date.
   */
  async getAvailability(date) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS booked FROM bookings
       WHERE booking_date = ? AND status = 'booked'`,
      [date]
    );
    const booked = rows[0].booked;
    return {
      total: TOTAL_SEATS,
      booked,
      available: TOTAL_SEATS - booked
    };
  }
};

module.exports = SeatModel;
