const path = require('node:path');

const maxFileSize = Number(process.env.DMS_MAX_FILE_SIZE_BYTES ?? 10485760);
const allowedExtensions = (process.env.DMS_ALLOWED_EXTENSIONS
  ?? '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx')
  .split(',').map((extension) => extension.trim().toLowerCase());
const supportedExtensions = [
  '.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx',
];
const maxStorageBytes = Number(process.env.DMS_MAX_STORAGE_BYTES ?? 1073741824);
const maxDocuments = Number(process.env.DMS_MAX_DOCUMENTS ?? 1000);
const maxUploadsPerHour = Number(process.env.DMS_MAX_UPLOADS_PER_HOUR ?? 30);
const proxySharedSecret = process.env.DMS_PROXY_SHARED_SECRET;
const storageDirectory = path.resolve(__dirname, '../storage');

for (const [name, value] of [
  ['DMS_MAX_FILE_SIZE_BYTES', maxFileSize],
  ['DMS_MAX_STORAGE_BYTES', maxStorageBytes],
  ['DMS_MAX_DOCUMENTS', maxDocuments],
  ['DMS_MAX_UPLOADS_PER_HOUR', maxUploadsPerHour],
]) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
}
if (allowedExtensions.some((extension) => !supportedExtensions.includes(extension))) {
  throw new Error('DMS_ALLOWED_EXTENSIONS deve conter formatos suportados como .pdf,.txt.');
}
if (proxySharedSecret !== undefined && Buffer.byteLength(proxySharedSecret) < 32) {
  throw new Error('DMS_PROXY_SHARED_SECRET deve conter pelo menos 32 bytes.');
}

module.exports = {
  maxFileSize,
  allowedExtensions,
  maxStorageBytes,
  maxDocuments,
  maxUploadsPerHour,
  proxySharedSecret,
  storageDirectory,
};
