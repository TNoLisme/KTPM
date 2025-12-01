const BaseFilter = require('./BaseFilter');
const Order = require('../models/orderModel');

class RollbackOrderFilter extends BaseFilter {
    async execute(data) {
        const { orderId, traceId } = data; // Lấy traceId
        if (orderId) {
            console.warn(`↩️ [${traceId}] [Rollback: Order] Deleting Order ${orderId}...`); // Log với ID
            await Order.findByIdAndDelete(orderId);
        }
        return data;
    }
}
module.exports = RollbackOrderFilter;