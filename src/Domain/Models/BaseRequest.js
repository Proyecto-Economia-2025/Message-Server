class BaseRequest {

    constructor(data, service, endpoint) {
        this.correlationId = data.CorrelationId || '';
        this.service = service;
        this.endpoint = endpoint;
        this.timestamp = new Date(); 
        
        this.success = null; 
        this.executionTimeMs = 0; 
        this.serverHost = "";

        this.emailAddress = data.EmailAddress || null;
        this.messageRecipient = data.MessageRecipient || null;
        this.subject = data.Subject || null;
        this.messageBody = data.MessageBody || null;
        this.platformType = data.PlatformType || null;
        this.pdfFileName = data.PdfFileName || null; 
    }

    toLogObject() {
        return {
            correlationId: this.correlationId,
            service: this.service,
            endpoint: this.endpoint,
            timestamp: this.timestamp.toISOString(),
            success: this.success,
            executionTimeMs: this.executionTimeMs,
            platformType: this.platformType,
            pdfFileName: this.pdfFileName
        };
    }
}

module.exports = BaseRequest;