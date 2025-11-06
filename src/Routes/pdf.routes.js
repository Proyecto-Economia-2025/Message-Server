const express = require('express')
const router = express.Router();
const messageController = require('../Presentation/Controllers/MessageController');

router.post('/process-message', messageController.processMessage);

module.exports = router;