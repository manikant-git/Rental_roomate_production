const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { pool } = require('./models/db');
const { redisClient } = require('./utils/redis');
const { connectKafka } = require('./utils/kafka');
const listingRoutes = require('./routes/listings');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json());
app.use(morgan('combined'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'listing-service' }));
app.use('/api/listings', listingRoutes);

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connected');
    await redisClient.ping();
    logger.info('Redis connected');
    await connectKafka();
    app.listen(PORT, () => logger.info(`Listing service running on port ${PORT}`));
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

start();
