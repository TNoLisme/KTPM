// backend/middlewares/limiter.js
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    message: { success: false, message: "Quá nhiều lần thử. Vui lòng quay lại sau 15 phút." },
    standardHeaders: true,
    legacyHeaders: false,
});

exports.paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 20, 
    message: { success: false, message: "Giao dịch bị từ chối do tần suất quá cao." }
});

exports.spamThrottler = slowDown({
    windowMs: 60 * 60 * 1000, 
    delayAfter: 5, 
    delayMs: (hits) => hits * 1000, 
});

exports.spamLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 20, 
    message: { success: false, message: "Bạn thao tác quá nhanh, vui lòng nghỉ ngơi chút." }
});


exports.adminLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: { success: false, message: "Phát hiện hoạt động Admin bất thường. Đã chặn tạm thời." }
});

exports.publicReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { success: false, message: "Quá nhiều yêu cầu từ IP của bạn." }
});