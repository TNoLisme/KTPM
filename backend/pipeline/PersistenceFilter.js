const BaseFilter = require('./BaseFilter');
const Order = require('../models/orderModel');

class PersistenceFilter extends BaseFilter {
    async execute(data) {
        const { input, user, traceId } = data; // Lấy traceId
        console.log(`[${traceId}] [Persistence] Saving Order to DB...`); // Log với ID

        const order = await Order.create({
            shippingInfo: input.shippingInfo,
            orderItems: input.orderItems,
            paymentInfo: input.paymentInfo,
            totalPrice: input.totalPrice,
            paidAt: Date.now(),
            user: user._id,
            orderStatus: "Processing"
        });

        data.orderId = order._id;
        data.totalPrice = input.totalPrice;
        data.status = "ORDER_CREATED";

        return data;
    }
}
module.exports = PersistenceFilter;