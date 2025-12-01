const rateLimit = require("express-rate-limit");
const {RedisStore} = require("rate-limit-redis");
const { client } = require('../../utils/redisClient');

const paymentRateLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
        prefix: "rl:payment:",
    }),
    windowMs: 60 * 60 * 1000, 
    max: 10, 
    message: { success: false, message: "Giao dịch bị từ chối do tần suất quá cao. Vui lòng thử lại sau." }
});

const checkIdempotency = async (req, res, next) => {
    const { paymentId } = req.body; 

    if (!paymentId) {
        return next();
    }

    const key = `idempotency:${paymentId}`;
    
    try {
        const cachedResponse = await client.get(key);
        
        if (cachedResponse) {
            return res.status(200).json(JSON.parse(cachedResponse));
        }
        
        const originalSend = res.json;
        res.json = function (body) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                client.setEx(key, 86400, JSON.stringify(body));
            }
            originalSend.call(this, body);
        };

        next();
    } catch (error) {
        console.error("Idempotency Error:", error);
        next();
    }
};

module.exports = { paymentRateLimiter, checkIdempotency };