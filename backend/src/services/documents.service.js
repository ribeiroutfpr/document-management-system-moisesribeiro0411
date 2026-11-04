const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const repository = require('../repositories/documents.repository');
const { allowedExtensions, maxDocuments, maxStorageBytes } = require('../config');
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

async function validateFileContent(file, extension) {
  const handle = await fs.open(file.path, 'r');
  try {
    if (extension === '.txt' || extension === '.csv') {
      if (!await isTextFile(handle)) {
        throw new DocumentError('FILE_CONTENT_INVALID', 'O conteúdo não corresponde ao formato informado.');
      }
      return;
    }

    const header = Buffer.alloc(8);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const signatures = {
      '.pdf': (data) => data.subarray(0, 5).toString('ascii') === '%PDF-',
      '.doc': isLegacyOffice,
      '.xls': isLegacyOffice,
      '.ppt': isLegacyOffice,
      '.docx': isZip,
      '.xlsx': isZip,
      '.pptx': isZip,
    };
    if (!signatures[extension]?.(bytes)) {
      throw new DocumentError('FILE_CONTENT_INVALID', 'O conteúdo não corresponde ao formato informado.');
    }
  } finally {
    await handle.close();
  }
}

async function isTextFile(handle) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunk = Buffer.alloc(8192);
  let position = 0;
  while (true) {
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
    if (bytesRead === 0) break;
    const bytes = chunk.subarray(0, bytesRead);
    if (bytes.includes(0) || !isValidText(decoder, bytes, { stream: true })) return false;
    position += bytesRead;
  }
  return isValidText(decoder);
}

function isValidText(decoder, bytes, options) {
  try {
    decoder.decode(bytes, options);
    return true;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function isLegacyOffice(bytes) {
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
}

function isZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3]);
}

async function createDocument(file, owner) {
  const extension = validateExtension(file.originalname);
  try {
    await validateFileContent(file, extension);
    const document = await repository.save({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      filename: file.filename,
      contentType: contentTypes[extension] || 'application/octet-stream',
    }, { maxDocuments, maxStorageBytes });
    return toPublicDocument(document);
  } catch (error) {
    await fs.unlink(file.path).catch((cleanupError) => {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  }
}

async function listDocuments(owner) {
  return (await repository.findAll())
    .filter((document) => document.owner === owner)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(toPublicDocument);
}

async function getDownload(id, owner) {
  const document = await repository.findById(id);
  if (!document || document.owner !== owner) {
    throw new DocumentError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  return {
    filePath: await repository.getFilePath(document),
    originalName: document.originalName,
    contentType: document.contentType,
  };
}

module.exports = {
  validateExtension,
  createStorageFilename(originalName) {
    return `${randomUUID()}${validateExtension(originalName)}`;
  },
  createDocument,
  listDocuments,
  getDownload,
};
