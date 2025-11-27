const axios = require('axios');

// Token lấy từ F12
const USER_TOKEN = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjZjMjJiZTI5Y2M3OGQwNjZmODQwZCIsImlhdCI6MTc2NDIwOTUzNiwiZXhwIjoxNzY0ODE0MzM2fQ.OzRG-2AHbz5HGAx7tfZ9wXURN2mYqdhdXOCJpRig5i8";

const createPendingOrder = async () => {
    try {
        console.log("🚀 Gửi đơn hàng MỚI (Chưa thanh toán)...");

        const res = await axios.post('http://localhost:4000/api/v1/order/new', {
            shippingInfo: { address: "Test", city: "HN", phoneNo: 123456780, pincode: 10000, country: "VN", state: "HN" },
            orderItems: [{ name: "Tai nghe 5", price: 50, quantity: 2, product: "6927370cbcd5864d588c21aa", image: "https://res.cloudinary.com/dtynrncs2/image/upload/v1764177689/products/iocyppryapxolyqpwfc1.png" }], // Thay ID sản phẩm thật vào
            totalPrice: 1400,

            // QUAN TRỌNG: Giả lập đơn chưa thanh toán
            paymentInfo: { id: "", status: "NOT_PAID_YET" }
        }, {
            headers: { 'Cookie': USER_TOKEN }
        });

        console.log("✅ Đã gửi đơn:", res.data);
        console.log("👉 Hãy nhìn vào Console Backend, bạn sẽ thấy nó gọi MoMo và in ra QR Code Link!");

    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
};

createPendingOrder();