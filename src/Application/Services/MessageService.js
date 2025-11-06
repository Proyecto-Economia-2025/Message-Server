const axios = require('axios');
const FormData = require('form-data');
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const IMessageServer = require('../../Domain/Interfaces/IMessageService');
const LOCAL_STORAGE_URL = process.env.PYTHON_SERVER_URL;
const { logWithCorrelation } = require('../../Infrastructure/Logging/logging_config');
const { errorLogger, eventLogger } = require('../../Infrastructure/Messaging/KafkaLoggers');

class MessageService extends IMessageServer {

    async getPDF(correlationId) {
        try {
            logWithCorrelation('info', `Solicitando PDF con Correlation ID: ${correlationId} desde Python Server`, correlationId);

            const response = await axios.get(`http://localhost:5000/pdf-storage/${correlationId}`, {
                responseType: 'arraybuffer',
            });

            logWithCorrelation('info', `PDF obtenido exitosamente - Tamaño: ${response.data.length} bytes`, correlationId);

            await eventLogger.logEvent({
                eventType: 'PDF_FETCHED_FROM_STORAGE',
                description: `PDF recuperado desde Python Server - Tamaño: ${response.data.length} bytes`,
                metadata: {
                    correlationId: correlationId,
                    fileSize: response.data.length,
                    storageUrl: `${LOCAL_STORAGE_URL}/pdf-storage/${correlationId}`
                }
            }, correlationId);

            return response.data;
        } catch (error) {
            logWithCorrelation('error', `Error al obtener PDF: ${error.message}`, correlationId, {
                stack: error.stack
            });

            await errorLogger.logError({
                errorType: 'PDFRetrievalError',
                message: `Error al obtener PDF desde Python Server: ${error.message}`,
                stackTrace: error.stack,
                context: {
                    correlationId: correlationId,
                    storageUrl: `${LOCAL_STORAGE_URL}/pdf-storage/${correlationId}`,
                    statusCode: error.response?.status
                }
            }, correlationId);

            throw error;
        }
    }



    async sendPdfToDiscord(pdfBuffer, requestData) {

        if (!DISCORD_WEBHOOK) {
            const errorMsg = "DISCORD_WEBHOOK_URL no está configurada en el entorno. No se puede enviar el mensaje.";
            logWithCorrelation('error', errorMsg, requestData.correlationId);
            
            await errorLogger.logError({
                errorType: 'ConfigurationError',
                message: errorMsg,
                context: { correlationId: requestData.correlationId }
            }, requestData.correlationId);
            
            throw new Error(errorMsg);
        }

        try {
            logWithCorrelation('info', `Preparando envío a Discord - Correlation ID: ${requestData.correlationId}`, requestData.correlationId);

            const finalFileName = `${requestData.pdfFileName.split('.')[0]}-${requestData.correlationId}.pdf`;

            const form = new FormData();

            form.append('file', pdfBuffer, {
                filename: finalFileName,
                contentType: 'application/pdf'
            });

            // Añadir el payload (obtenida del json) al mensaje
            form.append('payload_json', JSON.stringify({
                content: `**NOTIFICACIÓN DE ENVÍO:** ID ${requestData.correlationId} | Plataforma ${requestData.platformType}\n\n${requestData.messageBody}`,
                username: 'PDF Notifier (Microservice)',
            }));

            logWithCorrelation('info', `Enviando PDF a Discord Webhook - Archivo: ${finalFileName}`, requestData.correlationId);

            // Enviar pdf al Discord
            const response = await axios.post(DISCORD_WEBHOOK, form, {
                headers: form.getHeaders(),
            });

            logWithCorrelation('info', `PDF enviado exitosamente a Discord - Status: ${response.status}`, requestData.correlationId);

            await eventLogger.logEvent({
                eventType: 'PDF_SENT_TO_DISCORD',
                description: `PDF enviado exitosamente a Discord - Archivo: ${finalFileName}`,
                metadata: {
                    correlationId: requestData.correlationId,
                    fileName: finalFileName,
                    platformType: requestData.platformType,
                    discordStatus: response.status,
                    fileSize: pdfBuffer.length
                }
            }, requestData.correlationId);

            return response;
        } catch (error) {
            logWithCorrelation('error', `Error al enviar PDF a Discord: ${error.message}`, requestData.correlationId, {
                stack: error.stack
            });

            await errorLogger.logError({
                errorType: 'DiscordSendError',
                message: `Error al enviar PDF a Discord: ${error.message}`,
                stackTrace: error.stack,
                context: {
                    correlationId: requestData.correlationId,
                    fileName: requestData.pdfFileName,
                    platformType: requestData.platformType,
                    statusCode: error.response?.status
                }
            }, requestData.correlationId);

            throw error;
        }
    }
}

module.exports = new MessageService();

