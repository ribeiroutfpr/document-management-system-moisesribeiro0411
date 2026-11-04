const multer = require('multer');
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
    try {
      callback(null, service.createStorageFilename(file.originalname));
    } catch (error) {
      callback(error);
    }
  },
});

const receiveFile = multer({
  storage,
  limits: {
    fileSize: maxFileSize + 1,
    files: 1,
    fields: 1,
    parts: 2,
    fieldNameSize: 100,
    fieldSize: 1024,
  },
}).single('file');

function handleUploadError(error, req, res, next) {
  if (!error) return next();
  if (error instanceof DocumentError) return next(error);
  if (error instanceof multer.MulterError) {
    const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE'
      : ['LIMIT_UNEXPECTED_FILE', 'LIMIT_FILE_COUNT', 'LIMIT_FIELD_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)
        ? 'INVALID_FILE_FIELD' : 'INVALID_UPLOAD';
    return next(new DocumentError(code, 'Upload inválido.', { cause: error }));
  }
  const message = typeof error.message === 'string' ? error.message : '';
  const malformed = message.startsWith('Multipart:') || message === 'Unexpected end of form';
  next(new DocumentError(malformed ? 'INVALID_UPLOAD' : 'STORAGE_WRITE_FAILED',
    malformed ? 'Requisição de upload inválida.' : 'Não foi possível gravar o arquivo.',
    { cause: error }));
}

function upload(req, res, next) {
  receiveFile(req, res, (error) => handleUploadError(error, req, res, next));
}

module.exports = upload;
