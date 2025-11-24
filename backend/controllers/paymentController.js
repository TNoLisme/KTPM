const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Payment = require('../models/paymentModel');
const ErrorHandler = require('../utils/errorHandler');
const { createMoMoPayment, checkTransactionStatus } = require('../utils/momoClient');

// API 1: Tạo yêu cầu thanh toán -> Trả về QR Code
exports.processPayment = asyncErrorHandler(async (req, res, next) => {
    const { amount, phoneNo } = req.body;

    // Tạo OrderID duy nhất: MOMO + Timestamp + Random
    const orderId = "MOMO" + new Date().getTime() + Math.floor(Math.random() * 1000);
    const orderInfo = `Thanh toán đơn hàng E-Commerce. Khách hàng: ${phoneNo || 'Guest'}`;

    try {
        // Gọi utility function đã tạo ở bước 1
        const momoResponse = await createMoMoPayment(orderId, amount, orderInfo);

        if (momoResponse && momoResponse.resultCode === 0) {
            // Trả về QR Code và OrderId để Frontend hiển thị và polling
            res.status(200).json({
                success: true,
                payUrl: momoResponse.payUrl,      // Link redirect (nếu user muốn click)
                qrCodeUrl: momoResponse.qrCodeUrl, // Link ảnh QR Code
                deeplink: momoResponse.deeplink,
                orderId: orderId,                 // ID để check status
                message: momoResponse.message
            });
        } else {
            return next(new ErrorHandler(momoResponse.message || "Tạo thanh toán MoMo thất bại", 500));
        }
    } catch (error) {
        return next(new ErrorHandler("Lỗi kết nối đến cổng thanh toán MoMo", 500));
    }
});

// API 2: Frontend gọi liên tục để kiểm tra trạng thái (Polling)
exports.getPaymentStatus = asyncErrorHandler(async (req, res, next) => {
    const { id } = req.params; // id ở đây là orderId của MoMo

    try {
        const statusResponse = await checkTransactionStatus(id);

        // resultCode = 0 nghĩa là giao dịch thành công
        if (statusResponse.resultCode === 0) {

            // Kiểm tra xem đã lưu vào DB chưa để tránh trùng lặp
            let payment = await Payment.findOne({ orderId: statusResponse.orderId });

            if (!payment) {
                // Nếu chưa có thì lưu vào DB
                payment = await Payment.create({
                    orderId: statusResponse.orderId,
                    txnId: statusResponse.transId,
                    amount: statusResponse.amount,
                    resultCode: statusResponse.resultCode,
                    message: statusResponse.message,
                    status: "succeeded"
                });
            }

            res.status(200).json({
                success: true,
                status: "succeeded",
                paymentInfo: {
                    id: payment.txnId,
                    status: payment.status
                }
            });
        } else {
            // Giao dịch chưa hoàn tất hoặc thất bại
            // resultCode = 1000 (Initiated), 9000 (Processing)...
            res.status(200).json({
                success: true,
                status: "pending",
                message: statusResponse.message
            });
        }

    } catch (error) {
    // Không return error 500 để frontend tiếp tục polling nếu lỗi mạng thoáng qua
        res.status(200).json({
            success: false,
            status: "error",
            message: "Waiting..."
        });
    }
});

// API 3: Callback (Webhook) - MoMo gọi vào đây (Backup cho Polling)
exports.paytmResponse = asyncErrorHandler(async (req, res, next) => {
    // Chỉ cần trả về status 204 để MoMo biết đã nhận tin
    // Logic chính đã xử lý ở API getPaymentStatus (Polling)
    res.status(204).send();
});

// API: Gửi Stripe Key (Giữ lại dummy để frontend cũ không crash nếu lỡ gọi)
exports.sendStripeApiKey = asyncErrorHandler(async (req, res, next) => {
    res.status(200).json({ stripeApiKey: "" });
});