const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// Import Filters
const ValidationFilter = require('../filters/ValidationFilter');
const InventoryFilter = require('../filters/InventoryFilter');
const PersistenceFilter = require('../filters/PersistenceFilter');
const PaymentFilter = require('../filters/PaymentFilter');
const NotificationFilter = require('../filters/NotificationFilter');
const RollbackOrderFilter = require('../filters/RollbackOrderFilter');
const RollbackInventoryFilter = require('../filters/RollbackInventoryFilter');

// Config Redis
const connection = new IORedis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
});

// Định nghĩa Queue Names
const QUEUES = {
    VALIDATE: 'pipe-1-validate',
    INVENTORY: 'pipe-2-inventory',
    PERSIST: 'pipe-3-persist',
    PAYMENT: 'pipe-4-payment',
    NOTIFY: 'pipe-5-notify',
    ROLLBACK_ORDER: 'saga-rollback-order',
    ROLLBACK_INVENTORY: 'saga-rollback-inventory'
};

// Khởi tạo Queues
const queues = {};
Object.keys(QUEUES).forEach(key => {
    queues[key] = new Queue(QUEUES[key], {
        connection,
        defaultJobOptions: { removeOnComplete: true, removeOnFail: false }
    });
});

// --- HÀM TIỆN ÍCH TẠO WORKER ---
const createWorker = (queueName, FilterClass, nextQueueName, failQueueName, options = {}) => {
    const filterInstance = new FilterClass();

    const worker = new Worker(queueName, async (job) => {
        const resultData = await filterInstance.execute(job.data);

        if (nextQueueName) {
            await queues[nextQueueName].add('next-step', resultData);
        }
        return resultData;
    }, { connection, ...options });

    // Handle SAGA / Failures
    worker.on('failed', async (job, err) => {
        const isFatal = job.attemptsMade >= (job.opts.attempts || 1);
        if (isFatal && failQueueName) {
            console.warn(`[SAGA] Triggering Compensation: ${failQueueName}`);
            await queues[failQueueName].add('compensate', job.data);
        }
    });
    return worker;
};

// === KHỞI TẠO WORKER ===

// 1. Validate -> Inventory
createWorker(QUEUES.VALIDATE, ValidationFilter, 'INVENTORY', null, { concurrency: 5 });

// 2. Inventory -> Persist
createWorker(QUEUES.INVENTORY, InventoryFilter, 'PERSIST', null, { concurrency: 10, attempts: 3 });

// --- 3. PERSIST (CUSTOM ROUTING LOGIC) ---
// Bước này cần logic đặc biệt: Nếu đã thanh toán -> Bỏ qua Payment -> Sang Notify
const persistFilter = new PersistenceFilter();
const persistWorker = new Worker(QUEUES.PERSIST, async (job) => {

    // 1. Thực hiện lưu DB
    const resultData = await persistFilter.execute(job.data);

    // 2. Kiểm tra trạng thái thanh toán từ Input
    const paymentStatus = resultData.input.paymentInfo?.status;

    if (paymentStatus === "succeeded" || paymentStatus === "TXN_SUCCESS") {
        console.log(`[Router] Order ${resultData.orderId} already paid. Skipping Payment Gateway -> Notify.`);
        // Bỏ qua bước PAYMENT, đi thẳng sang NOTIFY
        await queues[QUEUES.NOTIFY].add('send-email', resultData);
    } else {
        // Chưa thanh toán (luồng SEDA thuần túy) -> Sang PAYMENT
        console.log(`[Router] New Order. Routing to Payment Gateway.`);
        await queues[QUEUES.PAYMENT].add('init-payment', resultData);
    }

    return resultData;

}, { connection, concurrency: 10, attempts: 3 });

// SAGA cho Persist
persistWorker.on('failed', async (job, err) => {
    if (job.attemptsMade >= 3) {
        await queues[QUEUES.ROLLBACK_INVENTORY].add('compensate', job.data);
    }
});


// 4. Payment -> Notify (SAGA: Rollback Order)
createWorker(QUEUES.PAYMENT, PaymentFilter, 'NOTIFY', 'ROLLBACK_ORDER', { concurrency: 100, attempts: 5 });

// 5. Notify -> End
createWorker(QUEUES.NOTIFY, NotificationFilter, null, null, { concurrency: 20, attempts: 10 });

// === WORKER BÙ TRỪ (SAGA) ===
createWorker(QUEUES.ROLLBACK_ORDER, RollbackOrderFilter, 'ROLLBACK_INVENTORY', null);
createWorker(QUEUES.ROLLBACK_INVENTORY, RollbackInventoryFilter, null, null);

console.log("🚀 SEDA PIPELINE (SMART ROUTING) STARTED.");

module.exports = { entryQueue: queues.VALIDATE };