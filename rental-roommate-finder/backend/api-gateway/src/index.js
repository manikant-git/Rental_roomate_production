const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const Redis = require('ioredis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3000;

const redis = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*', credentials: true }));
app.use(morgan('combined'));
app.use(express.json());

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests' },
  standardHeaders: true,
});
app.use(globalLimiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

app.get('/health', async (req, res) => {
  const services = {
    gateway: 'ok',
    redis: 'unknown',
  };
  try { await redis.ping(); services.redis = 'ok'; } catch { services.redis = 'error'; }
  res.json({ status: 'ok', services });
});

// Proxy config
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      logger.error(`Proxy error to ${target}:`, err.message);
      res.status(502).json({ error: 'Service unavailable' });
    }
  }
});

// Route proxies
app.use('/api/auth', authLimiter, createProxyMiddleware(proxyOptions(process.env.AUTH_SERVICE_URL)));
app.use('/api/listings', createProxyMiddleware(proxyOptions(process.env.LISTING_SERVICE_URL)));
app.use('/api/roommates', createProxyMiddleware(proxyOptions(process.env.ROOMMATE_SERVICE_URL)));
app.use('/api/notifications', createProxyMiddleware(proxyOptions(process.env.NOTIFICATION_SERVICE_URL)));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => logger.info(`API Gateway running on port ${PORT}`));
