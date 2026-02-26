const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/authMiddleware');
const bookingController = require('../controllers/bookingController');

router.post('/book', isLoggedIn, bookingController.bookSeat);
router.post('/cancel', isLoggedIn, bookingController.cancelBooking);

module.exports = router;
