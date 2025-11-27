const axios = require('axios');
const crypto = require('crypto');
const process = require('process');

// ================= CẤU HÌNH (THAY ĐỔI TẠI ĐÂY) =================
const CONCURRENT_USERS = 500;
const TARGET_URL = "http://localhost:4000/api/v1";

// Dán Token lấy từ F12 vào đây
const USER_TOKEN = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjZjMjJiZTI5Y2M3OGQwNjZmODQwZCIsImlhdCI6MTc2NDIxNjQyNiwiZXhwIjoxNzY0ODIxMjI2fQ.buW4xXqOKC8Ueon3hlZRvhUTWyLidh9nbVa3Ciqe3y4";

const MOMO_CONFIG = {
    partnerCode: "MOMO",
    accessKey: "F8BBA842ECF85",
    secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz"
};
// ===============================================================

// Biến thống kê
let successCount = 0;
let failCount = 0;
const apiResponseLatencies = []; // Thời gian server trả lời HTTP (Quan trọng cho Pipeline)
const totalProcessLatencies = []; // Thời gian hoàn tất cả luồng
const startTime = Date.now();
const errorMap = {};

// Hàm tính toán thống kê
const calculateStats = (latencies) => {
    if (latencies.length === 0) return { min: 0, max: 0, mean: 0, p95: 0 };

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: (sum / sorted.length).toFixed(2),
        p95: sorted[Math.floor(sorted.length * 0.95)],
    };
};

// Hàm theo dõi lỗi
const trackError = (error) => {
    const key = error.response ? `HTTP_${error.response.status}` : `NET_${error.code || error.message}`;
    errorMap[key] = (errorMap[key] || 0) + 1;
};

// Giả lập 1 User
const simulateOneUser = async (userIndex) => {
    const startUserTime = Date.now();

    try {
        // --- BƯỚC 1: GỌI API TẠO ĐƠN (Đo API Latency) ---
        const fakePhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
        const amount = 1400;

        const createRes = await axios.post(`${TARGET_URL}/order/new`, { // Lưu ý endpoint order/new
            shippingInfo: { address: "Test", city: "HN", phoneNo: 123456789, pincode: 10000, country: "VN", state: "HN" },
            orderItems: [{
                name: `Product ${userIndex}`, price: 1000, quantity: 1,
                product: "672823b9b0b2c3d4e5f6a7b8", image: "http://img.com/a.jpg"
            }],
            totalPrice: 1400,
            paymentInfo: { id: `PAY_${Date.now()}_${userIndex}`, status: "PENDING" }
        }, {
            headers: { 'Content-Type': 'application/json', 'Cookie': USER_TOKEN }
        });

        // ĐO THỜI GIAN PHẢN HỒI API (ĐÂY LÀ CHỈ SỐ QUAN TRỌNG CỦA PIPELINE)
        const apiLatency = Date.now() - startUserTime;
        apiResponseLatencies.push(apiLatency);

        // Lấy Order ID (Hoặc TraceID nếu Pipeline)
        const orderId = createRes.data.orderId || createRes.data.traceId || "UNKNOWN";

        // --- BƯỚC 2: GIẢ LẬP MOMO CALLBACK (IPN) ---
        // Bước này để đảm bảo luồng chạy hết, nhưng trong load test thực tế
        // ta quan tâm API Latency ở bước 1 hơn.

        /* LƯU Ý: Nếu Backend Pipeline đang chạy bất đồng bộ, việc gọi Callback ngay lập tức
           có thể xảy ra trước khi Worker kịp tạo Order trong DB. 
           Tuy nhiên ta vẫn gọi để tạo tải cho DB.
        */

        const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
            .update(`accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=&message=Success&orderId=${orderId}&orderInfo=Thanh toán đơn hàng E-Commerce&orderType=momo_wallet&partnerCode=${MOMO_CONFIG.partnerCode}&payType=qr&requestId=${orderId}&responseTime=${Date.now()}&resultCode=0&transId=${Date.now()}`)
            .digest('hex');

        await axios.post(`${TARGET_URL}/callback`, {
            partnerCode: MOMO_CONFIG.partnerCode, accessKey: MOMO_CONFIG.accessKey, requestId: orderId,
            amount: String(amount), orderId: orderId, orderInfo: "Info", orderType: "momo_wallet",
            transId: Date.now(), resultCode: 0, message: "Success", payType: "qr", responseTime: Date.now(), extraData: "",
            signature: signature
        });

        // ĐO TỔNG THỜI GIAN (End-to-End)
        const totalLatency = Date.now() - startUserTime;
        totalProcessLatencies.push(totalLatency);

        successCount++;

    } catch (error) {
        trackError(error);
        failCount++;
    }
};

const runLoadTest = async () => {
    console.log(`🚀 STARTING LOAD TEST (${CONCURRENT_USERS} Users)...`);
    console.log(`👉 Mode: Measuring API Response vs Full Processing Time`);

    const initialMemory = process.memoryUsage().heapUsed;

    const promises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        promises.push(simulateOneUser(i));
    }

    await Promise.all(promises);

    const finalMemory = process.memoryUsage().heapUsed;
    const totalTimeSeconds = (Date.now() - startTime) / 1000;

    const apiStats = calculateStats(apiResponseLatencies);
    const totalStats = calculateStats(totalProcessLatencies);
    const throughput = CONCURRENT_USERS / totalTimeSeconds;
    const failureRate = (failCount / CONCURRENT_USERS) * 100;

    console.log("\n================== REPORT KẾT QUẢ ==================");
    console.log(`Total Time: ${totalTimeSeconds.toFixed(2)}s | RAM Used: ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Success: ${successCount} | Failed: ${failCount} (${failureRate.toFixed(2)}%)`);
    console.log("----------------------------------------------------");
    console.log(`⚡ THROUGHPUT (Khả năng chịu tải): ${throughput.toFixed(2)} Req/s`);
    console.log("----------------------------------------------------");
    console.log("1️⃣  API RESPONSE TIME (Trải nghiệm người dùng - User Wait Time)");
    console.log(`    - Avg (Trung bình): ${apiStats.mean} ms`);
    console.log(`    - P95 (95% User):   ${apiStats.p95} ms`);
    console.log("    (Số càng nhỏ càng tốt -> Chứng minh Non-blocking I/O)");
    console.log("----------------------------------------------------");
    console.log("2️⃣  TOTAL PROCESSING TIME (Thời gian xử lý hệ thống)");
    console.log(`    - Avg (Trung bình): ${totalStats.mean} ms`);
    console.log(`    - P95 (95% User):   ${totalStats.p95} ms`);
    console.log("====================================================");
    if (Object.keys(errorMap).length > 0) console.log("Error Details:", errorMap);
};

runLoadTest();