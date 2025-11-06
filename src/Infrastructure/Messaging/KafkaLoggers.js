const kafkaProducerService = require('./kafka_service');
const { logWithCorrelation } = require('../Logging/logging_config');

class ErrorLogger {
    constructor() {
        this.topic = process.env.KAFKA_ERROR_TOPIC || 'message-server-errors';
    }

    async logError(errorData, correlationId = null) {
        const errorMessage = {
            level: 'ERROR',
            errorType: errorData.errorType || 'UnknownError',
            errorMessage: errorData.message || errorData.errorMessage,
            stackTrace: errorData.stack || errorData.stackTrace,
            context: errorData.context || {},
            endpoint: errorData.endpoint,
            method: errorData.method,
        };

        // Log a archivo/consola
        logWithCorrelation('error', errorMessage.errorMessage, correlationId, {
            errorType: errorMessage.errorType,
            endpoint: errorMessage.endpoint,
            stack: errorMessage.stackTrace
        });

        // Enviar a Kafka
        await kafkaProducerService.sendMessage(this.topic, errorMessage, correlationId);
    }
}

class EventLogger {
    constructor() {
        this.topic = process.env.KAFKA_EVENT_TOPIC || 'message-server-events';
    }

    async logEvent(eventData, correlationId = null) {
        const eventMessage = {
            level: 'INFO',
            eventType: eventData.eventType,
            eventDescription: eventData.description || eventData.eventDescription,
            metadata: eventData.metadata || {},
            endpoint: eventData.endpoint,
            method: eventData.method,
        };

        // Log a archivo/consola
        logWithCorrelation('info', eventMessage.eventDescription, correlationId, {
            eventType: eventMessage.eventType,
            endpoint: eventMessage.endpoint
        });

        // Enviar a Kafka
        await kafkaProducerService.sendMessage(this.topic, eventMessage, correlationId);
    }
}

class RequestLogger {
    constructor() {
        this.topic = process.env.KAFKA_REQUEST_TOPIC || 'message-server-requests';
    }

    async logRequest(requestData, correlationId = null) {
        const requestMessage = {
            level: 'INFO',
            method: requestData.method,
            endpoint: requestData.endpoint,
            statusCode: requestData.statusCode,
            duration: requestData.duration,
            requestBody: requestData.requestBody || {},
            responseBody: requestData.responseBody || {},
            clientIp: requestData.clientIp,
            userAgent: requestData.userAgent,
        };

        // Log a archivo/consola
        const logMessage = `${requestMessage.method} ${requestMessage.endpoint} - ${requestMessage.statusCode} - ${requestMessage.duration}ms`;
        logWithCorrelation('info', logMessage, correlationId, {
            method: requestMessage.method,
            endpoint: requestMessage.endpoint,
            statusCode: requestMessage.statusCode
        });

        // Enviar a Kafka
        await kafkaProducerService.sendMessage(this.topic, requestMessage, correlationId);
    }
}

// Export singleton instances
module.exports = {
    errorLogger: new ErrorLogger(),
    eventLogger: new EventLogger(),
    requestLogger: new RequestLogger()
};
