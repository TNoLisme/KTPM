const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const {RedisStore} = require("rate-limit-redis");
const { client } = require('../../utils/redisClient'); 

const createRedisStore = (prefix) => new RedisStore({
    sendCommand: (...args) => client.sendCommand(args),
    prefix: `rl:${prefix}:`,
});

const spamThrottler = slowDown({
    store: createRedisStore("spam_throttle"), 
    windowMs: 60 * 60 * 1000, 
    delayAfter: 5, 
    delayMs: (hits) => hits * 1000, 
    maxDelayMs: 20000,
});

const spamLimiter = rateLimit({
    store: createRedisStore("spam_limit"),
    windowMs: 60 * 60 * 1000, 
    max: 20, 
    message: { 
        success: false, 
        message: "Bạn thao tác quá nhanh, vui lòng nghỉ ngơi chút." 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { spamThrottler, spamLimiter };