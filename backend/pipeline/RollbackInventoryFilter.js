const BaseFilter = require('./BaseFilter');
const Product = require('../models/productModel');

class RollbackInventoryFilter extends BaseFilter {
    async execute(data) {
        const { input, traceId } = data; // Lấy traceId
        console.warn(`↩️ [${traceId}] [Rollback: Inventory] Restoring stock...`); // Log với ID

        for (const item of input.orderItems) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: +item.quantity } } // Cộng lại
            );
        }
        return data;
    }
}
module.exports = RollbackInventoryFilter;