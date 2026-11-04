const path = require('node:path');
const fs = require('node:fs/promises');
const DocumentError = require('../errors');

const storageDirectory = path.resolve(__dirname, '../../storage');
const documents = new Map();

async function prepareStorage() {
  await fs.mkdir(storageDirectory, { recursive: true });
  return storageDirectory;
}

function save(document) {
  documents.set(document.id, document);
  return document;
}

function findAll() {
  return [...documents.values()];
}

function findById(id) {
  return documents.get(id);
}

async function getFilePath(document) {
  const filePath = path.join(storageDirectory, document.filename);
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new DocumentError('FILE_NOT_FOUND', 'Arquivo não encontrado.');
    }
    return filePath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new DocumentError('FILE_NOT_FOUND', 'Arquivo não encontrado.', { cause: error });
    }
    throw error;
  }
}

module.exports = { prepareStorage, save, findAll, findById, getFilePath };
