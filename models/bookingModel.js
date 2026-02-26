const pool = require('../config/db');

const TOTAL_SEATS = parseInt(process.env.TOTAL_SEATS) || 50;

const BookingModel = {
  /**
   * Get a user's active booking for a specific date.
   */
  async getUserBooking(userId, date) {
    const [rows] = await pool.execute(
      `SELECT b.*, s.seat_number
       FROM bookings b
       JOIN seats s ON s.id = b.seat_id
       WHERE b.user_id = ? AND b.booking_date = ? AND b.status = 'booked'`,
      [userId, date]
    );
    return rows[0] || null;
  },

  /**
   * Book a seat using a transaction with row-level locking.
   *
   * Dynamic model: there are no seat types. All 50 seats are generic.
   * Available = TOTAL_SEATS - booked count.
   * The transaction locks a candidate seat row to prevent race conditions.
   */
  async bookSeat(userId, date) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Check if user already has an active booking for this date
      const [existing] = await connection.execute(
        `SELECT id FROM bookings
         WHERE user_id = ? AND booking_date = ? AND status = 'booked'`,
        [userId, date]
      );

      if (existing.length > 0) {
        await connection.rollback();
        return { success: false, message: 'You already have a booking for today.' };
      }

      // 2. Find an available seat with row-level lock
      const [seats] = await connection.execute(
        `SELECT s.id, s.seat_number FROM seats s
         WHERE s.id NOT IN (
           SELECT b.seat_id FROM bookings b
           WHERE b.booking_date = ? AND b.status = 'booked'
         )
         ORDER BY s.seat_number
         LIMIT 1
         FOR UPDATE`,
        [date]
      );

      if (seats.length === 0) {
        await connection.rollback();
        return { success: false, message: 'No seats available.' };
      }

      const seat = seats[0];

      // 3. Insert booking
      const [result] = await connection.execute(
        'INSERT INTO bookings (user_id, seat_id, booking_date, status) VALUES (?, ?, ?, ?)',
        [userId, seat.id, date, 'booked']
      );

      await connection.commit();

      return {
        success: true,
        message: `Seat ${seat.seat_number} booked successfully.`,
        booking: { id: result.insertId, seatNumber: seat.seat_number }
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Cancel a booking. The seat automatically becomes available again
   * because availability is calculated dynamically (TOTAL_SEATS - booked count).
   */
  async cancelBooking(bookingId, userId) {
    const [result] = await pool.execute(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND user_id = ? AND status = 'booked'`,
      [bookingId, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Get all active bookings for a specific date (admin view).
   */
  async getBookingsByDate(date) {
    const [rows] = await pool.execute(
      `SELECT b.id, b.booking_date, b.status, b.created_at,
              u.name AS user_name, u.email AS user_email, u.batch,
              s.seat_number
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN seats s ON s.id = b.seat_id
       WHERE b.booking_date = ? AND b.status = 'booked'
       ORDER BY s.seat_number`,
      [date]
    );
    return rows;
  }
};

module.exports = BookingModel;
