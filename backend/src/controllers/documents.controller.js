const service = require('../services/documents.service');
const DocumentError = require('../errors');

async function upload(req, res) {
  if (!req.file) {
    throw new DocumentError('FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }
  res.status(201).json(await service.createDocument(req.file, req.user.id));
}

async function list(req, res) {
  res.json({ documents: await service.listDocuments(req.user.id) });
}

async function download(req, res, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    throw new DocumentError('INVALID_DOCUMENT_ID', 'Identificador de documento inválido.');
  }
  try {
    const document = await service.getDownload(req.params.id, req.user.id);
    res.download(document.filePath, document.originalName, {
      headers: {
        'Content-Type': document.contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    }, (error) => {
      if (error) next(toReadError(error));
    });
  } catch (error) {
    next(toReadError(error));
  }
}

function toReadError(error) {
  if (error instanceof DocumentError) return error;
  if (error.code === 'ENOENT') {
    return new DocumentError('FILE_NOT_FOUND', 'Arquivo não encontrado.', { cause: error });
  }
  return new DocumentError('STORAGE_READ_FAILED', 'Não foi possível ler o arquivo.', { cause: error });
}

module.exports = { upload, list, download };
