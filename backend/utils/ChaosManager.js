// backend/utils/ChaosManager.js

class ChaosManager {
    constructor() {
        this.attempts = new Map();
    }

    shouldThrowError(traceId, filterName, behavior) {
        const key = `${traceId}_${filterName}`;
        const count = this.attempts.get(key) || 0;
        this.attempts.set(key, count + 1);

        // Format: [User] [Filter]
        const logPrefix = `[Chaos] [${traceId}] [${filterName}]`;

        if (behavior === 'SUCCESS') return false;

        // --- Logic Retry (Lỗi 2 lần đầu) ---
        if ((behavior === 'RETRY_INVENTORY' && filterName === 'InventoryFilter') ||
            (behavior === 'RETRY_PERSISTENCE' && filterName === 'PersistenceFilter') ||
            (behavior === 'RETRY_PAYMENT' && filterName === 'PaymentFilter')) {

            if (count < 2) {
                console.log(`${logPrefix} Injecting SIMULATED ERROR (Attempt ${count + 1})`);
                return true;
            }
        }

        // --- Logic Saga Fail (Lỗi vĩnh viễn) ---
        if (
            (behavior === 'FAIL_SAGA_PERSISTENCE' && filterName === 'PersistenceFilter') || // 👈 ĐÃ THÊM LOGIC NÀY
            (behavior === 'FAIL_SAGA_PAYMENT' && filterName === 'PaymentFilter')) {

            // Trong trường hợp FAIL_SAGA, nó sẽ luôn trả về true, khiến retryFilter chạy hết maxRetries
            console.log(`[Chaos] [${traceId}] [${filterName}] Injecting FATAL ERROR (Saga Trigger)`);
            return true;
        }

        return false;
    }
}

module.exports = new ChaosManager();