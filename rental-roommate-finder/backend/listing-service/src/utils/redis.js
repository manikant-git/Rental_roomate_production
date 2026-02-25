const Redis = require('ioredis');
const logger = require('./logger');
const redisClient = new Redis(process.env.REDIS_URL, { retryStrategy: (t) => Math.min(t * 100, 3000) });
redisClient.on('error', (err) => logger.error('Redis error:', err));

// Cache helpers
async function getCache(key) {
  const val = await redisClient.get(key);
  return val ? JSON.parse(val) : null;
}

async function setCache(key, value, ttlSeconds = 300) {
  await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
}

async function deleteCache(pattern) {
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) await redisClient.del(...keys);
}

module.exports = { redisClient, getCache, setCache, deleteCache };
