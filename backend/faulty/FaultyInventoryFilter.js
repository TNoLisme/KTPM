const InventoryFilter = require('../pipeline/InventoryFilter'); // Import Filter thật
const chaosManager = require('../utils/ChaosManager');

class FaultyInventoryFilter extends InventoryFilter {
    async execute(data) {
        const behavior = data.input.behavior || 'SUCCESS';
        // Kiểm tra xem có cần ném lỗi không
        if (chaosManager.shouldThrowError(data.traceId, 'InventoryFilter', behavior)) {
            throw new Error("Simulated Inventory DB Connection Timeout");
        }

        // Nếu không lỗi, gọi logic gốc của InventoryFilter 
        return super.execute(data);
    }
}
module.exports = FaultyInventoryFilter;