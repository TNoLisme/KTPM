const express = require('express');
const { processPayment, paytmResponse, getPaymentStatus, sendStripeApiKey } = require('../controllers/paymentController');
const { isAuthenticatedUser } = require('../middlewares/auth');
const {paymentLimiter} = require("../middlewares/limiter");
const router = express.Router();

// Tạo yêu cầu thanh toán (lấy QR)
router.route('/payment/process').post(isAuthenticatedUser, paymentLimiter, processPayment);

// Kiểm tra trạng thái thanh toán (Polling)
router.route('/payment/status/:id').get(isAuthenticatedUser, getPaymentStatus);

// Webhook MoMo
router.route('/callback').post(paytmResponse);

// Route cũ (để tránh lỗi frontend cũ)
router.route('/stripeapikey').get(isAuthenticatedUser, sendStripeApiKey);

module.exports = router;