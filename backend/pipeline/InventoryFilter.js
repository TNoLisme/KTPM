const BaseFilter = require('./BaseFilter');
const Product = require('../models/productModel');

class InventoryFilter extends BaseFilter {
    async execute(data) {
        const { input, traceId } = data; // Lấy traceId
        console.log(`[${traceId}] [Inventory] Reserving stock...`); // Log với ID

        for (const item of input.orderItems) {
            const product = await Product.findOneAndUpdate(
                { _id: item.product, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } }
            );

            if (!product) throw new Error(`Sản phẩm ID ${item.product} hết hàng`);
        }

        data.status = "STOCK_RESERVED";
        return data;
    }
}
module.exports = InventoryFilter;