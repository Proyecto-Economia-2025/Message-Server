const messageService = require('../../Application/Services/MessageService');
const BaseRequest = require('../../Domain/Models/BaseRequest');
const { logWithCorrelation } = require('../../Infrastructure/Logging/logging_config');
const { errorLogger, eventLogger } = require('../../Infrastructure/Messaging/KafkaLoggers');

exports.processMessage = async (req, res) => {
    const correlationId = req.correlationId;
    
    // Log inicio del endpoint
    logWithCorrelation('info', `Iniciando procesamiento del endpoint /receive-pdf`, correlationId);
    
    const requestData = new BaseRequest(
        req.body, 
        "Message Server", 
        req.path
    );

    logWithCorrelation('info', `Correlation ID recibido en controller: ${requestData.correlationId}`, correlationId);

    // Validación de entrada
    if (!requestData.correlationId || !requestData.pdfFileName) {
        requestData.success = false;
        
        logWithCorrelation('error', `Fallo de validación de entrada: falta CorrelationId o PdfFileName`, correlationId);
        
        await errorLogger.logError({
            errorType: 'ValidationError',
            message: 'Missing CorrelationId or PdfFileName',
            endpoint: req.path,
            method: req.method,
            context: { body: req.body }
        }, correlationId);
        
        return res.status(400).json({ message: 'Missing CorrelationId or PdfFileName.' });
    }

    const startTime = process.hrtime.bigint();

    try {
        // Log evento: obtención de PDF
        logWithCorrelation('info', `Solicitando PDF con Correlation ID: ${requestData.correlationId}`, correlationId);
        
        const pdfBuffer = await messageService.getPDF(requestData.correlationId);

        logWithCorrelation('info', `PDF recibido correctamente - Tamaño: ${pdfBuffer.length} bytes`, correlationId);
        
        await eventLogger.logEvent({
            eventType: 'PDF_RECEIVED',
            description: `PDF recibido exitosamente - Nombre: ${requestData.pdfFileName}, Tamaño: ${pdfBuffer.length} bytes`,
            endpoint: req.path,
            method: req.method,
            metadata: {
                fileName: requestData.pdfFileName,
                fileSize: pdfBuffer.length,
                correlationId: requestData.correlationId
            }
        }, correlationId);

        // Enviar PDF a Discord
        logWithCorrelation('info', `Enviando PDF a Discord para Correlation ID: ${requestData.correlationId}`, correlationId);
        
        const discordResponse = await messageService.sendPdfToDiscord(pdfBuffer, requestData);

        logWithCorrelation('info', `PDF enviado a Discord exitosamente - Status: ${discordResponse.status}`, correlationId);

        const endTime = process.hrtime.bigint();
        requestData.executionTimeMs = Number(endTime - startTime) / 1000000;
        requestData.success = true;

        // Log evento de éxito
        await eventLogger.logEvent({
            eventType: 'MESSAGE_PROCESSED_SUCCESS',
            description: `Petición procesada exitosamente en ${requestData.executionTimeMs.toFixed(2)}ms`,
            endpoint: req.path,
            method: req.method,
            metadata: {
                correlationId: requestData.correlationId,
                platformType: requestData.platformType,
                executionTimeMs: requestData.executionTimeMs,
                discordStatus: discordResponse.status,
                pdfFileSize: pdfBuffer.length
            }
        }, correlationId);

        logWithCorrelation('info', `[ÉXITO] Petición procesada en ${requestData.executionTimeMs.toFixed(2)}ms`, correlationId);
        
        res.status(200).json({ 
            message: `Job ${requestData.correlationId} successfully fetched PDF buffer.`,
            pdfFileSize: `${pdfBuffer.length} bytes`, 
            platformType: requestData.platformType, 
            discordStatus: discordResponse.status,
            executionTimeMs: requestData.executionTimeMs.toFixed(2)
        });

    } catch (error) {
        const endTime = process.hrtime.bigint();
        requestData.executionTimeMs = Number(endTime - startTime) / 1000000;
        requestData.success = false;

        logWithCorrelation('error', `[FALLO] Error procesando petición: ${error.message}`, correlationId, {
            stack: error.stack
        });

        // Log error a Kafka
        await errorLogger.logError({
            errorType: error.name || 'UnknownError',
            message: error.message,
            stackTrace: error.stack,
            endpoint: req.path,
            method: req.method,
            context: {
                correlationId: requestData.correlationId,
                executionTimeMs: requestData.executionTimeMs,
                requestData: requestData.toLogObject()
            }
        }, correlationId);

        res.status(500).json({
            message: 'Error processing message',
            error: error.message,
            correlationId: requestData.correlationId
        });
    }
};