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
// backend/controllers/paymentController.js

exports.getPaymentStatus = asyncErrorHandler(async (req, res, next) => {
    const { id } = req.params; // id là orderId

    // BƯỚC 1: Kiểm tra trong Database nội bộ TRƯỚC
    // (Vì script giả lập của bạn đã lưu vào đây qua hàm paytmResponse ở trên)
    const localPayment = await Payment.findOne({ orderId: id });

    if (localPayment && localPayment.status === "succeeded") {
        return res.status(200).json({
            success: true,
            status: "succeeded",
            paymentInfo: {
                id: localPayment.txnId,
                status: localPayment.status
            }
        });
    }

    // BƯỚC 2: Nếu Database chưa có (hoặc chưa thành công), mới gọi sang MoMo thật
    // (Logic cũ giữ nguyên để dự phòng cho trường hợp production)
    try {
        const statusResponse = await checkTransactionStatus(id);

        if (statusResponse.resultCode === 0) {
            // Nếu MoMo thật báo thành công, lưu vào DB và trả về
            await Payment.create({
                orderId: statusResponse.orderId,
                txnId: statusResponse.transId,
                amount: statusResponse.amount,
                resultCode: statusResponse.resultCode,
                message: statusResponse.message,
                status: "succeeded"
            });

            return res.status(200).json({
                success: true,
                status: "succeeded",
                paymentInfo: {
                    id: statusResponse.transId,
                    status: "succeeded"
                }
            });
        }
    } catch (error) {
        // Lỗi kết nối MoMo thì bỏ qua, chỉ trả về pending
    }

    // BƯỚC 3: Nếu cả 2 đều chưa thấy thành công
    res.status(200).json({
        success: true,
        status: "pending",
        message: "Waiting for payment..."
    });
});

// API 3: Callback (Webhook) - MoMo gọi vào đây (Backup cho Polling)
// backend/controllers/paymentController.js

exports.paytmResponse = asyncErrorHandler(async (req, res, next) => {
    // 1. Nhận dữ liệu từ IPN (Script giả lập hoặc MoMo thật gửi về)
    const { orderId, transId, resultCode, message, amount } = req.body;

    console.log(`🔔 IPN Received for Order: ${orderId}, ResultCode: ${resultCode}`);

    // 2. Tìm xem đã có bản ghi thanh toán này trong DB chưa
    let payment = await Payment.findOne({ orderId: orderId });

    // 3. Nếu resultCode = 0 (Thành công), Lưu/Cập nhật vào DB
    if (Number(resultCode) === 0) {
        if (!payment) {
            await Payment.create({
                orderId,
                txnId: transId,
                amount,
                resultCode,
                message,
                status: "succeeded" // Quan trọng: Đánh dấu là thành công
            });
        } else {
            // Nếu đã có thì cập nhật trạng thái
            payment.status = "succeeded";
            payment.resultCode = resultCode;
            payment.txnId = transId;
            await payment.save();
        }
    }

    // 4. Trả về 204 cho MoMo (hoặc script) biết đã nhận tin
    res.status(204).send();
});

// API: Gửi Stripe Key (Giữ lại dummy để frontend cũ không crash nếu lỡ gọi)
exports.sendStripeApiKey = asyncErrorHandler(async (req, res, next) => {
    res.status(200).json({ stripeApiKey: "" });
});