const BaseFilter = require('./BaseFilter');
const Order = require('../models/orderModel');

class ValidationFilter extends BaseFilter {
    async execute(data) {
        const { input, traceId } = data; // Lấy traceId
        console.log(`[${traceId}] [Validation] Checking inputs...`); // Log với ID

        if (!input.orderItems || input.orderItems.length === 0) throw new Error("Giỏ hàng rỗng");
        if (!input.shippingInfo) throw new Error("Thiếu thông tin giao hàng");

        // Idempotency Check
        const exists = await Order.findOne({ 'paymentInfo.id': input.paymentInfo.id }).lean();
        // if (exists) throw new Error("Đơn hàng đã tồn tại");

        // Output: Đánh dấu đã validate
        data.status = "VALIDATED";
        return data;
    }
}
module.exports = ValidationFilter;