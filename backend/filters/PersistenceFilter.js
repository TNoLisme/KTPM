const BaseFilter = require('./BaseFilter');
const Order = require('../models/orderModel');

class PersistenceFilter extends BaseFilter {
    async execute(data) {
        const { input, user, traceId } = data; // Lấy thêm traceId
        console.log(`[Filter: Persistence] Saving Order to DB...`);

        // --- FIX LỖI VALIDATION paymentInfo.id ---
        // Nếu frontend không gửi paymentInfo hoặc thiếu id, ta tạo giá trị mặc định
        const safePaymentInfo = input.paymentInfo || {};

        if (!safePaymentInfo.id) {
            // Tạo ID tạm thời để vượt qua Mongoose Validation
            // Sau này khi thanh toán xong, IPN sẽ cập nhật lại ID thật
            safePaymentInfo.id = `PENDING_${traceId || Date.now()}`;
        }

        if (!safePaymentInfo.status) {
            safePaymentInfo.status = "PENDING_PAYMENT";
        }
        // -----------------------------------------

        try {
            // Tạo đơn hàng
            const order = await Order.create({
                shippingInfo: input.shippingInfo,
                orderItems: input.orderItems,
                paymentInfo: safePaymentInfo, // Dùng biến đã fix lỗi
                totalPrice: input.totalPrice,
                paidAt: Date.now(),
                user: user.id,
                orderStatus: "Processing"
            });

            console.log(`[Filter: Persistence] Saved Order ID: ${order._id}`);

            // Output: Thêm OrderId vào context
            data.orderId = order._id;
            data.status = "ORDER_CREATED";
            return data;

        } catch (error) {
            // Log rõ lỗi để debug
            console.error(`[Persistence Error] ${error.message}`);
            throw error; // Ném lỗi để Worker Manager bắt và kích hoạt SAGA
        }
    }
}
module.exports = PersistenceFilter;