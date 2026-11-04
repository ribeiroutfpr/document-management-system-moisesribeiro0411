const maxFileSize = Number(process.env.DMS_MAX_FILE_SIZE_BYTES ?? 10485760);
const allowedExtensions = (process.env.DMS_ALLOWED_EXTENSIONS
  ?? '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx')
  .split(',').map((extension) => extension.trim().toLowerCase());
const defaultOwner = (process.env.DMS_DEFAULT_OWNER ?? 'local-instance').trim();

if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('DMS_MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}
if (allowedExtensions.some((extension) => !/^\.[a-z0-9]+$/.test(extension))) {
  throw new Error('DMS_ALLOWED_EXTENSIONS deve conter extensões como .pdf,.txt.');
}
if (!defaultOwner) {
  throw new Error('DMS_DEFAULT_OWNER não pode ser vazio.');
}

module.exports = { maxFileSize, allowedExtensions, defaultOwner };
