const amqp = require('amqplib');
const logger = require('./logger');
let channel = null;

async function connectRabbitMQ() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await conn.createChannel();
  await channel.assertExchange('notifications', 'topic', { durable: true });
  await channel.assertQueue('email.welcome', { durable: true });
  await channel.bindQueue('email.welcome', 'notifications', 'email.welcome');
  logger.info('RabbitMQ ready');
}

function publishMessage(exchange, routingKey, message) {
  if (!channel) throw new Error('RabbitMQ not connected');
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
}

module.exports = { connectRabbitMQ, publishMessage };
