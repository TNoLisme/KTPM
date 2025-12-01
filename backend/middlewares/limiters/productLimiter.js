const slowDown = require("express-slow-down");
const {RedisStore} = require("rate-limit-redis");
const { client } = require('../../utils/redisClient');

const productReadThrottler = slowDown({
    store: new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
        prefix: "rl:product_read:", 
    }),
    windowMs: 1 * 60 * 1000, 
    delayAfter: 20, 
    
    delayMs: (hits) => hits * 500, 
    
    maxDelayMs: 20000,
});

module.exports = productReadThrottler;