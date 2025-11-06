const winston = require('winston');
const path = require('path');

// Definir el formato personalizado similar a Loguru
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, correlationId, stack }) => {
        const corrId = correlationId ? `[${correlationId}] ` : '';
        const stackTrace = stack ? `\n${stack}` : '';
        return `${timestamp} | ${level.toUpperCase().padEnd(7)} | ${corrId}${message}${stackTrace}`;
    })
);

// Configurar el logger principal
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // Consola con colores
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        }),
        // Archivo para todos los logs
        new winston.transports.File({
            filename: path.join('logs', 'message-server.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        }),
        // Archivo solo para errores
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
        })
    ]
});

// Función helper para agregar correlation ID a los logs
const logWithCorrelation = (level, message, correlationId, meta = {}) => {
    logger.log({
        level,
        message,
        correlationId,
        ...meta
    });
};

module.exports = {
    logger,
    logWithCorrelation
};
