const { Router } = require('express');
const controller = require('../controllers/documents.controller');
const authenticateProxy = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const limitUploads = require('../middleware/upload-limits.middleware');

const router = Router();

router.post('/upload', authenticateProxy, limitUploads, upload, controller.upload);
router.get('/documents', authenticateProxy, controller.list);
router.get('/documents/:id/download', authenticateProxy, controller.download);

module.exports = router;
