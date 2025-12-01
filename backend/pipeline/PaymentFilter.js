const BaseFilter = require('./BaseFilter');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');
const { createMoMoPayment } = require('../utils/momoClient');

const IS_LOAD_TEST = process.env.LOAD_TEST_MODE === 'true';

class PaymentFilter extends BaseFilter {
    async execute(data) {
        const { input, user, orderId, totalPrice, traceId } = data; // Lấy traceId
        console.log(`[${traceId}] [Payment] Processing for Order ${orderId}...`); // Log với ID

        // Check Idempotency (Tránh trùng lặp)
        if (data.paymentCreated) {
            console.log(`[${traceId}] [PaymentFilter] Payment already processed for orderId ${orderId}`);
            return data;
        }

        let momoResult;

        try {
            const orderIdMomo = "MOMO" + orderId;
            const orderInfo = `Thanh toán đơn hàng E-Commerce. Khách hàng: ${user.name}`;

            // Gọi hàm này để dòng log [MOCK] bên trong nó được chạy
            momoResult = await createMoMoPayment(orderIdMomo, totalPrice, orderInfo);

        } catch (error) {
            // Ném lỗi ra để Pipeline bắt và Rollback
            throw new Error(`Payment Failed: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Kiểm tra có record chưa trước khi tạo
        const existingPayment = await Payment.findOne({ orderId });
        if (!existingPayment) {
            await Payment.create({
                orderId,
                txnId: momoResult.transId || "PENDING_" + orderId,
                amount: totalPrice,
                resultCode: momoResult.resultCode,
                message: momoResult.message,
                status: "succeeded"
            });
            data.paymentCreated = true;
        } else {
            console.log(`[${traceId}] [PaymentFilter] Payment record already exists for ${orderId}, skipping create`);
            data.paymentCreated = true;
        }

        await Order.findByIdAndUpdate(orderId, { orderStatus: "Paid" });

        data.status = "PAYMENT_COMPLETED";
        data.paymentResult = {
            id: momoResult.transId || "PENDING_" + orderId,
            status: "succeeded",
            payUrl: momoResult.payUrl
        };

        return data;
    }
}
module.exports = PaymentFilter;