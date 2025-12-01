const { Queue } = require('bullmq');


const orderQueue = new Queue('order-queue', { 
    connection: { 
        host: '127.0.0.1', 
        port: 6379 
    } 
});

module.exports = orderQueue;