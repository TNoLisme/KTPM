// run_multy_user_test.js

// ============================================================
// 1. CẤU HÌNH MOMO (FIX LỖI CRYPTO KEY UNDEFINED)
// ============================================================
// Gán trực tiếp vào biến môi trường để utils/momoClient.js đọc được
process.env.MOMO_PARTNER_CODE = "MOMO";
process.env.MOMO_ACCESS_KEY = "F8BBA842ECF85";
process.env.MOMO_SECRET_KEY = "K951B6PE1waDMi640xX08PD3vg6EkVlz"; // Key quan trọng nhất
process.env.MOMO_ENDPOINT = "https://test-payment.momo.vn/v2/gateway/api/create";
process.env.MOMO_IPN_URL = "https://webhook.site/your-webhook-url"; // URL giả định
process.env.LOAD_TEST_MODE = 'true';
const mongoose = require('mongoose');
const PipelineQueue = require('./backend/pipeline/Pipeline');
const DLQ = require('./backend/models/DLQModel');
// --- IMPORT FILTERS ---
// Kiểm tra lại đường dẫn nếu máy bạn khác
const ValidationFilter = require('./backend/pipeline/ValidationFilter');
const FaultyInventoryFilter = require('./backend/faulty/FaultyInventoryFilter');
const FaultyPersistenceFilter = require('./backend/faulty/FaultyPersistenceFilter');
const FaultyPaymentFilter = require('./backend/faulty/FaultyPaymentFilter');

const RollbackInventoryFilter = require('./backend/pipeline/RollbackInventoryFilter');
const RollbackOrderFilter = require('./backend/pipeline/RollbackOrderFilter');

// --- CONFIG DB ---
const MONGO_URI = "mongodb+srv://23021746_db_user:van12345@cluster0.lwnasyi.mongodb.net/?appName=Cluster0";

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect(MONGO_URI);
        console.log("[Test] MongoDB Connected");
    } catch (error) {
        console.error("[Test] DB Connection Failed:", error);
        process.exit(1);
    }
};
const runTest = async () => {
    await connectDB();

    console.log("\n[Test] [SETUP] Initializing Pipeline...");

    const filters = [
        new ValidationFilter(),
        new FaultyInventoryFilter(),
        new FaultyPersistenceFilter(),
        new FaultyPaymentFilter()
    ];

    const rollbackFilters = [new RollbackOrderFilter(), new RollbackInventoryFilter()];

    const workerConfig = {
        ValidationFilter: 5,
        FaultyInventoryFilter: 5,
        FaultyPersistenceFilter: 5,
        FaultyPaymentFilter: 10
    };

    const pipeline = new PipelineQueue(filters, rollbackFilters, workerConfig, 3);
    pipeline.start();

    // --- KỊCH BẢN 6 USER ---
    const users = [
        { id: "USER_HAPPY", behavior: "SUCCESS" },
        { id: "USER_RETRY_INV", behavior: "RETRY_INVENTORY" },
        { id: "USER_RETRY_DB", behavior: "RETRY_PERSISTENCE" },
        { id: "USER_RETRY_PAY", behavior: "RETRY_PAYMENT" },
        // 2 User này sẽ vào DLQ
        { id: "USER_SAGA_ORDER", behavior: "FAIL_SAGA_PERSISTENCE" },
        { id: "USER_SAGA_PAY", behavior: "FAIL_SAGA_PAYMENT" }
    ];

    console.log(`\n[Test]  [START] Injecting ${users.length} jobs to Input Queue...`);

    const promises = users.map(user => {
        const traceId = `[${user.id}]`;
        const randomTxnId = `MOCK_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        const jobData = {
            input: {
                behavior: user.behavior,
                shippingInfo: { address: "123 Test St", city: "Hanoi", state: "HN", country: "VN", pincode: "10000", phoneNo: "0999" },
                orderItems: [{ name: "Test Item", price: 50000, quantity: 1, image: "img", product: "6927370cbcd5864d588c21aa" }],
                totalPrice: 50000,
                paymentInfo: { id: randomTxnId, status: "TXN_SUCCESS" }
            },
            user: { _id: "652a0b5c1234567890abcdef", name: user.id },
            traceId: traceId
        };

        return pipeline.addJob(jobData)
            .then(res => ({ user: user.id, status: "SUCCESS" }))
            .catch(err => ({ user: user.id, status: "FAILED_SAGA" }));
    });

    await Promise.all(promises);

    console.log("\n---------------------------------------------------------------");
    console.log("[Test]  [FINAL REPORT - PIPELINE]");
    console.log("---------------------------------------------------------------");

    // Đợi 1 chút để DB kịp lưu DLQ (vì việc lưu là async không chặn luồng chính)
    await new Promise(r => setTimeout(r, 1000));

    // --- KIỂM TRA DLQ TRONG MONGODB ---
    const dlqRecords = await DLQ.find({}).sort({ createdAt: -1 });

    console.log(`[Test]  Found ${dlqRecords.length} records in DLQ (Dead Letter Queue):`);

    dlqRecords.forEach(doc => {
        console.log(`\n[Test]  [DLQ Entry] TraceID: ${doc.traceId}`);
        console.log(`[Test] Failed At: ${doc.failedAtStep}`);
        console.log(`[Test] Steps Completed: ${JSON.stringify(doc.stepsCompleted)}`);
        console.log(`[Test] Reason: ${doc.errorReason}`);
        console.log(`[Test] Rollback Status: ${doc.rollbackStatus}`);
    });

    console.log("\n[Test] Test finished. Exiting...");
    process.exit(0);
};

runTest();