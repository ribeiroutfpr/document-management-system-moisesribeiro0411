const { randomUUID } = require('node:crypto');
const path = require('node:path');
const repository = require('../repositories/documents.repository');
const { allowedExtensions, defaultOwner } = require('../config');
const DocumentError = require('../errors');

const contentTypes = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function validateExtension(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    throw new DocumentError('FILE_TYPE_NOT_ALLOWED', 'Extensão de arquivo não permitida.');
  }
  return extension;
}

function toPublicDocument({ id, originalName, size, uploadedAt, owner }) {
  return { id, originalName, size, uploadedAt, owner };
}

function createDocument(file) {
  const extension = validateExtension(file.originalname);
  const document = repository.save({
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner: defaultOwner,
    filename: file.filename,
    contentType: contentTypes[extension] || 'application/octet-stream',
  });
  return toPublicDocument(document);
}

function listDocuments() {
  return repository.findAll()
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(toPublicDocument);
}

async function getDownload(id) {
  const document = repository.findById(id);
  if (!document) {
    throw new DocumentError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  return {
    filePath: await repository.getFilePath(document),
    originalName: document.originalName,
    contentType: document.contentType,
  };
}

module.exports = { validateExtension, createDocument, listDocuments, getDownload };
