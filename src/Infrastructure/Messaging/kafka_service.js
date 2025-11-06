const { Kafka, logLevel } = require('kafkajs');
const { logger } = require('../Logging/logging_config');

class KafkaProducerService {
    constructor() {
        this.kafka = null;
        this.producer = null;
        this.isConnected = false;
    }

    async initialize() {
        try {
            const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS 
                ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(',') 
                : ['localhost:9092'];

            this.kafka = new Kafka({
                clientId: process.env.KAFKA_CLIENT_ID || 'message-server',
                brokers: brokers,
                logLevel: logLevel.NOTHING, // Silenciar logs internos de Kafka
                retry: {
                    initialRetryTime: 100,
                    retries: 3 // Reducir reintentos
                }
            });

            this.producer = this.kafka.producer();
            
            // Intentar conectar con timeout
            await Promise.race([
                this.producer.connect(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout')), 3000)
                )
            ]);
            
            this.isConnected = true;
            logger.info('✓ Kafka Producer conectado exitosamente');
        } catch (error) {
            this.isConnected = false;
            logger.warn(`⚠ Kafka no disponible - El servidor funcionará sin Kafka (solo logs a archivo)`);
            // No lanzamos el error para que el servidor pueda seguir funcionando sin Kafka
        }
    }

    async sendMessage(topic, message, correlationId = null) {
        if (!this.isConnected) {
            logger.warn(`Kafka no está conectado. Mensaje no enviado al topic: ${topic}`);
            return false;
        }

        try {
            const messageValue = {
                ...message,
                timestamp: new Date().toISOString(),
                correlationId: correlationId,
                service: 'message-server'
            };

            await this.producer.send({
                topic: topic,
                messages: [
                    {
                        key: correlationId || null,
                        value: JSON.stringify(messageValue),
                        headers: {
                            'correlation-id': correlationId || '',
                            'service': 'message-server'
                        }
                    }
                ]
            });

            logger.info(`Mensaje enviado a Kafka topic: ${topic}`, { correlationId });
            return true;
        } catch (error) {
            logger.error(`Error al enviar mensaje a Kafka topic ${topic}: ${error.message}`, {
                correlationId,
                stack: error.stack
            });
            return false;
        }
    }

    async disconnect() {
        if (this.producer && this.isConnected) {
            try {
                await this.producer.disconnect();
                this.isConnected = false;
                logger.info('Kafka Producer desconectado');
            } catch (error) {
                logger.error(`Error al desconectar Kafka Producer: ${error.message}`);
            }
        }
    }
}

// Singleton instance
const kafkaProducerService = new KafkaProducerService();

module.exports = kafkaProducerService;
