const PaymentFilter = require('../pipeline/PaymentFilter');
const chaosManager = require('../utils/ChaosManager');

class FaultyPaymentFilter extends PaymentFilter {
    async execute(data) {
        const behavior = data.input.behavior || 'SUCCESS';
        if (chaosManager.shouldThrowError(data.traceId, 'PaymentFilter', behavior)) {
            throw new Error("Simulated Payment Gateway Timeout (504)");
        }
        return super.execute(data);
    }
}
module.exports = FaultyPaymentFilter;