const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const roommateRoutes = require('./routes/roommates');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json());
app.use(morgan('combined'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'roommate-service' }));
app.use('/api/roommates', roommateRoutes);

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => logger.info(`Roommate service running on port ${PORT}`));
