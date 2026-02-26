const pool = require('../config/db');
const bcrypt = require('bcrypt');

const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.execute('SELECT id, name, email, batch, role FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ name, email, password, batch, role = 'user' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, batch, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, batch, role]
    );
    return result.insertId;
  },

  async getAll() {
    const [rows] = await pool.execute(
      'SELECT id, name, email, batch, role, created_at FROM users ORDER BY batch, name'
    );
    return rows;
  },

  async deleteById(id) {
    await pool.execute('DELETE FROM users WHERE id = ? AND role != ?', [id, 'admin']);
  }
};

module.exports = UserModel;
