const pool = require('../config/db');

const LeaveModel = {
  /**
   * Check if a user has declared leave for a given date.
   */
  async hasLeave(userId, date) {
    const [rows] = await pool.execute(
      'SELECT id FROM leaves WHERE user_id = ? AND leave_date = ?',
      [userId, date]
    );
    return rows.length > 0;
  },

  /**
   * Declare leave for a user on a given date.
   */
  async declareLeave(userId, date) {
    await pool.execute(
      'INSERT IGNORE INTO leaves (user_id, leave_date) VALUES (?, ?)',
      [userId, date]
    );
  },

  /**
   * Cancel a declared leave.
   */
  async cancelLeave(userId, date) {
    const [result] = await pool.execute(
      'DELETE FROM leaves WHERE user_id = ? AND leave_date = ?',
      [userId, date]
    );
    return result.affectedRows > 0;
  },

  /**
   * Count total leaves declared for a given date.
   */
  async countByDate(date) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS count FROM leaves WHERE leave_date = ?',
      [date]
    );
    return rows[0].count;
  },

  /**
   * Get all leaves for a given date with user details (admin view).
   */
  async getLeavesByDate(date) {
    const [rows] = await pool.execute(
      `SELECT l.id, l.leave_date, u.name AS user_name, u.email AS user_email, u.batch
       FROM leaves l
       JOIN users u ON u.id = l.user_id
       WHERE l.leave_date = ?
       ORDER BY u.name`,
      [date]
    );
    return rows;
  }
};

module.exports = LeaveModel;
