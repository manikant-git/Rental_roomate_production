const Redis = require('ioredis');
const logger = require('./logger');
const redisClient = new Redis(process.env.REDIS_URL, { retryStrategy: (t) => Math.min(t * 100, 3000) });
redisClient.on('error', (err) => logger.error('Redis error:', err));
redisClient.on('connect', () => logger.info('Redis connected'));
module.exports = { redisClient };
