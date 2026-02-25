// Auth Service - Entry Point
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { pool } = require('./models/db');
const { redisClient } = require('./utils/redis');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const authRoutes = require('./routes/auth');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

app.use('/health', (req, res) => res.json({ status: 'ok', service: 'auth' }));
app.use('/api/auth', authRoutes);

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
    await connectRabbitMQ();
    logger.info('RabbitMQ connected');
    app.listen(PORT, () => logger.info(`Auth service running on port ${PORT}`));
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

start();
