const express = require('express');
const amqp = require('amqplib');
const { Kafka } = require('kafkajs');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }));

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function saveNotification(userId, type, title, body, data = {}) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)`,
      [userId, type, title, body, JSON.stringify(data)]
    );
  } catch (err) { logger.error('Failed to save notification:', err); }
}

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER) {
    logger.info(`[DEV] Email to ${to}: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: `"RentMate" <${process.env.SMTP_USER}>`, to, subject, html });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (err) { logger.error('Email failed:', err); }
}

// ─── RabbitMQ Consumer ───────────────────────────────────────────────────────
// Handles: email.welcome, email.verification, booking.request, roommate.match
async function startRabbitMQConsumer() {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertExchange('notifications', 'topic', { durable: true });

    const queues = ['email.welcome', 'email.booking', 'email.roommate_request'];
    for (const q of queues) {
      await channel.assertQueue(q, { durable: true });
      await channel.bindQueue(q, 'notifications', q);
    }

    // Welcome email
    channel.consume('email.welcome', async (msg) => {
      if (!msg) return;
      const { to, name, userId } = JSON.parse(msg.content.toString());
      await sendEmail(to, 'Welcome to RentMate!', `
        <h1>Welcome, ${name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>Start exploring listings and finding your perfect roommate!</p>
      `);
      await saveNotification(userId, 'welcome', 'Welcome to RentMate!', `Hi ${name}, your account is ready.`);
      channel.ack(msg);
    });

    // Booking confirmation
    channel.consume('email.booking', async (msg) => {
      if (!msg) return;
      const data = JSON.parse(msg.content.toString());
      await sendEmail(data.tenantEmail, `Tour Request - ${data.listingTitle}`, `
        <h2>Tour Request Received</h2>
        <p>Your tour request for <strong>${data.listingTitle}</strong> on ${data.tourDate} has been sent.</p>
        <p>The landlord will confirm shortly.</p>
      `);
      await saveNotification(data.tenantId, 'booking', 'Tour Request Sent', `For ${data.listingTitle}`, data);
      channel.ack(msg);
    });

    // Roommate request
    channel.consume('email.roommate_request', async (msg) => {
      if (!msg) return;
      const data = JSON.parse(msg.content.toString());
      await sendEmail(data.receiverEmail, `${data.senderName} wants to connect!`, `
        <h2>Roommate Request</h2>
        <p><strong>${data.senderName}</strong> wants to be your roommate.</p>
        <p>Message: ${data.message || 'No message'}</p>
        <a href="${process.env.APP_URL}/roommates/requests">View Request</a>
      `);
      await saveNotification(data.receiverId, 'roommate_request', `${data.senderName} wants to connect!`, data.message, data);
      channel.ack(msg);
    });

    logger.info('RabbitMQ consumers started');
  } catch (err) {
    logger.error('RabbitMQ consumer error:', err);
    setTimeout(startRabbitMQConsumer, 5000);
  }
}

// ─── Kafka Consumer ───────────────────────────────────────────────────────────
// Handles: listing.viewed (analytics), listing.created (notify matching searchers)
async function startKafkaConsumer() {
  try {
    const kafka = new Kafka({
      clientId: 'notification-service',
      brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    });

    const consumer = kafka.consumer({ groupId: 'notification-group' });
    await consumer.connect();
    await consumer.subscribe({ topics: ['listing.created', 'listing.viewed'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const data = JSON.parse(message.value.toString());
        logger.info(`Kafka event: ${topic}`, data);

        if (topic === 'listing.created') {
          // Find users who might be interested in this listing city/price range
          const interested = await pool.query(
            `SELECT u.email, u.first_name, rp.user_id FROM roommate_profiles rp
             JOIN users u ON u.id = rp.user_id
             WHERE rp.preferred_city ILIKE $1 AND rp.budget_max >= $2 AND rp.is_active = true LIMIT 50`,
            [`%${data.city}%`, data.rent * 0.9]
          );
          for (const user of interested.rows) {
            await sendEmail(user.email, `New listing in ${data.city}!`, `
              <h2>New listing matches your search!</h2>
              <p>A new listing has been posted in ${data.city} for $${data.rent}/month.</p>
              <a href="${process.env.APP_URL}/listings/${data.listingId}">View Listing</a>
            `);
          }
        }
      }
    });
    logger.info('Kafka consumer started');
  } catch (err) {
    logger.error('Kafka consumer error:', err);
    setTimeout(startKafkaConsumer, 10000);
  }
}

// Notification REST endpoints
app.get('/api/notifications', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [payload.userId]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

app.patch('/api/notifications/:id/read', async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

async function start() {
  await pool.query('SELECT 1');
  logger.info('PostgreSQL connected');
  app.listen(PORT, () => logger.info(`Notification service running on port ${PORT}`));
  await startRabbitMQConsumer();
  await startKafkaConsumer();
}

start().catch((err) => { logger.error('Startup failed:', err); process.exit(1); });
