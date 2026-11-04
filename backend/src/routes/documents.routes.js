const { Router } = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const controller = require('../controllers/documents.controller');
const service = require('../services/documents.service');
const repository = require('../repositories/documents.repository');
const { maxFileSize } = require('../config');
const DocumentError = require('../errors');

const storage = multer.diskStorage({
  destination(req, file, callback) {
    repository.prepareStorage().then(
      (directory) => callback(null, directory),
      (error) => callback(error),
    );
  },
  filename(req, file, callback) {
    callback(null, `${randomUUID()}${service.validateExtension(file.originalname)}`);
  },
});

const receiveFile = multer({
  storage,
  // Multer rejeita ao atingir o limite; um byte extra torna o máximo inclusivo.
  limits: { fileSize: maxFileSize + 1, files: 1 },
  fileFilter(req, file, callback) {
    try {
      service.validateExtension(file.originalname);
      callback(null, true);
    } catch (error) {
      callback(error);
    }
  },
}).single('file');

const router = Router();

router.post('/upload', (req, res, next) => {
  receiveFile(req, res, (error) => {
    if (!error) return next();
    if (error instanceof DocumentError) return next(error);
    if (error instanceof multer.MulterError) {
      const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE'
        : ['LIMIT_UNEXPECTED_FILE', 'LIMIT_FILE_COUNT'].includes(error.code)
          ? 'INVALID_FILE_FIELD' : 'INVALID_UPLOAD';
      return next(new DocumentError(code, 'Upload inválido.', { cause: error }));
    }
    const malformed = error.message.startsWith('Multipart:') || error.message === 'Unexpected end of form';
    next(new DocumentError(malformed ? 'INVALID_UPLOAD' : 'STORAGE_WRITE_FAILED',
      malformed ? 'Requisição de upload inválida.' : 'Não foi possível gravar o arquivo.',
      { cause: error }));
  });
}, controller.upload);
router.get('/documents', controller.list);
router.get('/documents/:id/download', controller.download);

module.exports = router;
