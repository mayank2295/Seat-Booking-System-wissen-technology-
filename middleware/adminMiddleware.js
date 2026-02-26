function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admins only.');
  res.redirect('/dashboard');
}

module.exports = { isAdmin };
