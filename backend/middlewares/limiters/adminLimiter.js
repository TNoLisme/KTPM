const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis"); 
const { client } = require('../../utils/redisClient');

const adminLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
        prefix: "rl:admin:", 
    }),
    windowMs: 60 * 60 * 1000, 
    max: 1000, 
    message: { 
        success: false, 
        message: "Phát hiện hoạt động Admin bất thường. Đã chặn tạm thời." 
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

module.exports = adminLimiter;