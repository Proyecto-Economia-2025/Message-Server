require('dotenv').config();
const express = require('express');
const app = express();
const pdfRoutes = require('./src/Routes/pdf.routes');
const port = process.env.PORT || 3000;

// Importar infraestructura de logs y Kafka
const { logger } = require('./src/Infrastructure/Logging/logging_config');
const kafkaProducerService = require('./src/Infrastructure/Messaging/kafka_service');
const { correlationIdMiddleware, addCorrelationHeaders } = require('./src/Middleware/correlation.middleware');

// Middlewares globales
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(addCorrelationHeaders);

// Rutas
app.use('/api/pdf', pdfRoutes);

// Inicializar Kafka Producer
const initializeServices = async () => {
    try {
        logger.info('Inicializando servicios...');
        await kafkaProducerService.initialize();
        logger.info('Servicios inicializados correctamente');
    } catch (error) {
        logger.error(`Error al inicializar servicios: ${error.message}`, { stack: error.stack });
    }
};

// Iniciar servidor
const server = app.listen(port, async () => {
    logger.info(`Message Server corriendo en puerto ${port}`);
    await initializeServices();
});

// Manejo de shutdown graceful
const gracefulShutdown = async () => {
    logger.info('Iniciando shutdown graceful...');
    
    server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        
        try {
            await kafkaProducerService.disconnect();
            logger.info('Servicios desconectados correctamente');
            process.exit(0);
        } catch (error) {
            logger.error(`Error durante el shutdown: ${error.message}`);
            process.exit(1);
        }
    });

    // Forzar salida si no se cierra en 10 segundos
    setTimeout(() => {
        logger.error('No se pudo cerrar el servidor gracefully, forzando salida');
        process.exit(1);
    }, 10000);
};

// Listeners para señales de terminación
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);