const axios = require('axios');
const crypto = require('crypto');
const process = require('process'); // Built-in Node module

// ================= CẤU HÌNH =================
const CONCURRENT_USERS = 1000;
const TARGET_URL = "http://localhost:4000/api/v1";

// THAY TOKEN VÀ MOMO CONFIG VÀO ĐÂY
const USER_TOKEN = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjZjMjJiZTI5Y2M3OGQwNjZmODQwZCIsImlhdCI6MTc2NDE1NjEyNiwiZXhwIjoxNzY0NzYwOTI2fQ.MWK8y2RgatWRihG0dG350muV-behzU2oLIlUQvVYptk";
const MOMO_CONFIG = {
    partnerCode: "MOMO",
    accessKey: "F8BBA842ECF85",
    secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz"
};
// ===========================================

// Biến đếm và thống kê
let successCount = 0;
let failCount = 0;
const allLatencies = [];
const startTime = Date.now();
const errorMap = {}; // *NEW*: Biến lưu trữ phân loại lỗi

// Hàm xử lý lỗi mới (ghi vào errorMap)
const trackError = (error) => {
    let errorKey;
    if (error.response) {
        // Lỗi HTTP (ví dụ: 401, 500, 404)
        errorKey = `HTTP_${error.response.status}`;
    } else if (error.code) {
        // Lỗi mạng (ví dụ: ECONNREFUSED, ETIMEDOUT)
        errorKey = `NET_${error.code}`;
    } else {
        // Lỗi chung (ví dụ: lỗi logic, token malformed)
        errorKey = `GENERIC_${error.message.substring(0, 20)}`;
    }

    errorMap[errorKey] = (errorMap[errorKey] || 0) + 1;
};


// Hàm xử lý cho 1 User trọn vẹn
const simulateOneUser = async (userIndex) => {
    const userStartTime = Date.now();

    try {
        // --- BƯỚC 1 & 2: TẠO GIAO DỊCH & GIẢ LẬP IPN ---
        const fakePhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
        const amount = 1400;

        const createRes = await axios.post(`${TARGET_URL}/payment/process`, {
            amount: amount,
            phoneNo: fakePhone
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': USER_TOKEN
            }
        });

        const { orderId } = createRes.data;
        if (!orderId) throw new Error("No orderId returned");

        const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=&message=Success&orderId=${orderId}&orderInfo=Thanh toán đơn hàng E-Commerce&orderType=momo_wallet&partnerCode=${MOMO_CONFIG.partnerCode}&payType=qr&requestId=${orderId}&responseTime=${Date.now()}&resultCode=0&transId=${Date.now()}`;

        const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
            .update(rawSignature)
            .digest('hex');

        await axios.post(`${TARGET_URL}/callback`, {
            partnerCode: MOMO_CONFIG.partnerCode, accessKey: MOMO_CONFIG.accessKey, requestId: orderId,
            amount: String(amount), orderId: orderId, orderInfo: "Thanh toán đơn hàng E-Commerce", orderType: "momo_wallet",
            transId: Date.now(), resultCode: 0, message: "Success", payType: "qr", responseTime: Date.now(), extraData: "",
            signature: signature
        });

        const latency = Date.now() - userStartTime;
        allLatencies.push(latency);
        successCount++;

    } catch (error) {
        trackError(error); // *NEW* Ghi lại lỗi
        failCount++;
    }
};

const calculateP95 = (latencies) => {
    if (latencies.length === 0) return 0;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    return sortedLatencies[p95Index];
};

// Hàm chạy main
const runLoadTest = async () => {
    console.log(`🚀 Starting Load Test with ${CONCURRENT_USERS} users...`);

    const promises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        promises.push(simulateOneUser(i));
    }

    // Ghi lại RAM trước khi chạy
    const initialMemory = process.memoryUsage().heapUsed;

    await Promise.all(promises);

    const totalTimeSeconds = (Date.now() - startTime) / 1000;

    // Ghi lại RAM sau khi chạy
    const finalMemory = process.memoryUsage().heapUsed;

    // Tính toán thống kê
    const totalSuccessLatency = allLatencies.reduce((sum, latency) => sum + latency, 0);
    const avgLatency = (totalSuccessLatency / successCount) || 0;
    const throughput = (CONCURRENT_USERS / totalTimeSeconds);
    const failureRate = (failCount / CONCURRENT_USERS) * 100;
    const p95Latency = calculateP95(allLatencies);

    console.log("\n================ BASELINE REPORT ================");
    console.log(`Total Run Time (s): ${totalTimeSeconds.toFixed(2)}`);
    console.log(`Total Success/Fail: ${successCount} / ${failCount}`);
    console.log("-------------------------------------------------");
    console.log(`1. Throughput (Req/s): ${throughput.toFixed(2)}`);
    console.log(`2. Failure Rate (%): ${failureRate.toFixed(2)}%`);
    console.log(`3. Avg Latency (ms): ${avgLatency.toFixed(2)}`);
    console.log(`4. P95 Latency (ms): ${p95Latency.toFixed(2)} (ms)`);
    console.log("-------------------------------------------------");
    console.log(`5. ERROR TYPES:`, errorMap); // *NEW* Phân loại lỗi
    console.log(`6. LOAD DRIVER MEMORY: ${(finalMemory - initialMemory) / (1024 * 1024)} MB`); // *NEW* Driver RAM
    console.log("=================================================");
};

runLoadTest();