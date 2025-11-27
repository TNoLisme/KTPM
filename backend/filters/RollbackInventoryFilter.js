const BaseFilter = require('./BaseFilter');
const Product = require('../models/productModel');

class RollbackInventoryFilter extends BaseFilter {
    async execute(data) {
        console.warn(`[SAGA] Rolling back Inventory...`);
        for (const item of data.input.orderItems) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: +item.quantity } } // Cộng lại
            );
        }
        return data;
    }
}
module.exports = RollbackInventoryFilter;