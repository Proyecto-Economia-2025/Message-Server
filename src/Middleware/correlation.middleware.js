const { v4: uuidv4 } = require('uuid');
const { logWithCorrelation } = require('../Infrastructure/Logging/logging_config');
const { requestLogger } = require('../Infrastructure/Messaging/KafkaLoggers');

// Middleware para generar o extraer el correlation ID
const correlationIdMiddleware = (req, res, next) => {
    const startTime = Date.now();
    
    // Extraer correlation ID de headers o generar uno nuevo
    let correlationId = req.headers['x-correlation-id'] || 
                        req.headers['correlation-id'] ||
                        uuidv4();
    
    const origin = req.headers['x-correlation-id'] || req.headers['correlation-id'] 
        ? 'Recibido desde cliente' 
        : 'Generado por servidor';

    // Agregar correlation ID al request para que esté disponible en toda la app
    req.correlationId = correlationId;

    // Log del inicio del request
    logWithCorrelation('info', 
        `${req.method} ${req.path} | Origen del Correlation ID: ${origin} | Timestamp: ${new Date().toISOString()} | Servicio: message-server | Servidor: ${req.hostname}`,
        correlationId
    );

    // Interceptar el fin del response para calcular duración
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;
        
        // Log de finalización del request
        logWithCorrelation('info',
            `Finalización de request | Status: ${res.statusCode} | Duración: ${duration}ms | Servidor: ${req.hostname} | ${success ? 'Éxito' : 'Fallo'}`,
            correlationId
        );

        // Enviar datos del request a Kafka (async, no bloqueante)
        requestLogger.logRequest({
            method: req.method,
            endpoint: req.path,
            statusCode: res.statusCode,
            duration: duration,
            requestBody: req.body,
            clientIp: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        }, correlationId);

        originalSend.call(this, data);
    };

    next();
};

// Middleware para agregar correlation ID a los headers de respuesta
const addCorrelationHeaders = (req, res, next) => {
    if (req.correlationId) {
        res.setHeader('X-Correlation-ID', req.correlationId);
    }
    next();
};

module.exports = {
    correlationIdMiddleware,
    addCorrelationHeaders
};
