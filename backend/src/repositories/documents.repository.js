const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { storageDirectory } = require('../config');
const DocumentError = require('../errors');

const catalogPath = path.join(storageDirectory, 'documents.json');
let documents;
let initialization;
let saveQueue = Promise.resolve();

async function prepareStorage() {
  await fs.mkdir(storageDirectory, { recursive: true, mode: 0o700 });
  return storageDirectory;
}

async function initialize() {
  if (!initialization) {
    initialization = (async () => {
      await prepareStorage();
      try {
        const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
        if (!Array.isArray(catalog) || catalog.some((document) => !isValidDocument(document))) {
          throw new Error('Catálogo de documentos inválido.');
        }
        documents = new Map(catalog.map((document) => [document.id, document]));
        if (documents.size !== catalog.length) {
          throw new Error('Catálogo de documentos inválido.');
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          documents = new Map();
          return;
        }
        throw error;
      }
    })();
  }
  await initialization;
}

function isValidDocument(document) {
  return document && typeof document.id === 'string'
    && typeof document.filename === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i
      .test(document.filename)
    && typeof document.originalName === 'string'
    && Number.isSafeInteger(document.size) && document.size >= 0
    && typeof document.uploadedAt === 'string'
    && typeof document.owner === 'string'
    && typeof document.contentType === 'string';
}

async function persistCatalog(catalog) {
  const temporaryPath = path.join(storageDirectory, `.documents-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(catalog), {
      flag: 'wx',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, catalogPath);
  } catch (error) {
    try {
      await fs.unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    }
    throw error;
  }
}

async function getStorageUsage() {
  const entries = await fs.readdir(storageDirectory, { withFileTypes: true });
  let totalBytes = 0;
  for (const entry of entries) {
    if (entry.name === '.gitkeep' || entry.name === path.basename(catalogPath)
      || entry.name.startsWith('.documents-')) continue;
    const stats = await fs.lstat(path.join(storageDirectory, entry.name));
    if (stats.isFile()) totalBytes += stats.size;
  }
  return totalBytes;
}

async function save(document, { maxDocuments, maxStorageBytes }) {
  await initialize();
  let release;
  const previousSave = saveQueue;
  saveQueue = new Promise((resolve) => { release = resolve; });
  await previousSave;
  try {
    const storageBytes = await getStorageUsage();
    if (documents.size >= maxDocuments || storageBytes > maxStorageBytes) {
      throw new DocumentError('STORAGE_QUOTA_EXCEEDED', 'Limite de armazenamento atingido.');
    }
    const updatedDocuments = new Map(documents);
    updatedDocuments.set(document.id, document);
    await persistCatalog([...updatedDocuments.values()]);
    documents = updatedDocuments;
    return document;
  } finally {
    release();
  }
}

async function findAll() {
  await initialize();
  return [...documents.values()];
}

async function findById(id) {
  await initialize();
  return documents.get(id);
}

async function getFilePath(document) {
  if (!isValidDocument(document)) {
    throw new DocumentError('FILE_NOT_FOUND', 'Arquivo não encontrado.');
  }
  const filePath = path.resolve(storageDirectory, document.filename);
  if (path.dirname(filePath) !== storageDirectory) {
    throw new DocumentError('FILE_NOT_FOUND', 'Arquivo não encontrado.');
  }
  try {
    const stats = await fs.lstat(filePath);
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

module.exports = { prepareStorage, save, findAll, findById, getFilePath, storageDirectory };
