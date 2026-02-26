const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Auth
router.post('/login', apiController.login);
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Real-time
router.get('/stream', apiController.stream);

// Seats
router.get('/seats', apiController.getSeats);

// Booking
router.post('/book', apiController.bookSeat);
router.post('/release', apiController.releaseSeat);

// User bookings
router.get('/my-bookings', apiController.myBookings);

// Activity log
router.get('/activity', apiController.activity);

// Schedule info
router.get('/schedule', apiController.schedule);

// Server time
router.get('/time', apiController.time);

module.exports = router;
