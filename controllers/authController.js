const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');

const authController = {
  getLogin(req, res) {
    if (req.session.user) {
      return req.session.user.role === 'admin'
        ? res.redirect('/admin')
        : res.redirect('/dashboard');
    }
    res.render('login', { title: 'Login' });
  },

  async postLogin(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        req.flash('error', 'Please enter email and password.');
        return res.redirect('/login');
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/login');
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/login');
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        batch: user.batch,
        role: user.role
      };

      return user.role === 'admin'
        ? res.redirect('/admin')
        : res.redirect('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      req.flash('error', 'An error occurred. Please try again.');
      res.redirect('/login');
    }
  },

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
};

module.exports = authController;
