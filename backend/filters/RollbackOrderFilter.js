const BaseFilter = require('./BaseFilter');
const Order = require('../models/orderModel');

class RollbackOrderFilter extends BaseFilter {
    async execute(data) {
        if (data.orderId) {
            console.warn(`[SAGA] Rolling back Order: ${data.orderId}`);
            await Order.findByIdAndDelete(data.orderId);
        }
        return data;
    }
}
module.exports = RollbackOrderFilter;