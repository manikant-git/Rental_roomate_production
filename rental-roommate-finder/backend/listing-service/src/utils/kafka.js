const { Kafka } = require('kafkajs');
const logger = require('./logger');

const kafka = new Kafka({
  clientId: 'listing-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
  retry: { initialRetryTime: 300, retries: 8 }
});

const producer = kafka.producer();
let connected = false;

async function connectKafka() {
  await producer.connect();
  connected = true;
  logger.info('Kafka producer connected');
}

async function publishEvent(topic, key, value) {
  if (!connected) return;
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(value), timestamp: Date.now().toString() }]
  });
}

// Kafka topics used by listing service:
// listing.viewed    → triggers analytics / recommendation engine
// listing.created   → triggers notification to matching roommate searchers
// listing.updated   → cache invalidation
// listing.deleted   → cleanup downstream

module.exports = { connectKafka, publishEvent };
