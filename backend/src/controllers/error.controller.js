const DocumentError = require('../errors');

const errors = {
  FILE_REQUIRED: [400, 'Envie um arquivo no campo file.'],
  INVALID_FILE_FIELD: [400, 'Envie apenas um arquivo no campo file.'],
  INVALID_UPLOAD: [400, 'Requisição de upload inválida.'],
  FILE_TOO_LARGE: [413, 'O arquivo excede o limite de tamanho permitido.'],
  FILE_TYPE_NOT_ALLOWED: [415, 'Extensão de arquivo não permitida.'],
  FILE_CONTENT_INVALID: [415, 'O conteúdo não corresponde ao formato informado.'],
  INVALID_DOCUMENT_ID: [400, 'Identificador de documento inválido.'],
  UNAUTHORIZED: [401, 'Autenticação necessária.'],
  PROXY_AUTH_NOT_CONFIGURED: [503, 'Autenticação do proxy não configurada.'],
  UPLOAD_RATE_LIMITED: [429, 'Limite de envios atingido. Tente novamente mais tarde.'],
  STORAGE_QUOTA_EXCEEDED: [507, 'Limite de armazenamento atingido.'],
  DOCUMENT_NOT_FOUND: [404, 'Documento não encontrado.'],
  FILE_NOT_FOUND: [404, 'Arquivo não encontrado.'],
  STORAGE_WRITE_FAILED: [500, 'Não foi possível gravar o arquivo.'],
  STORAGE_READ_FAILED: [500, 'Não foi possível ler o arquivo.'],
  ROUTE_NOT_FOUND: [404, 'Rota não encontrada.'],
  INVALID_JSON: [400, 'Corpo JSON inválido.'],
  REQUEST_TOO_LARGE: [413, 'O corpo da requisição excede o limite permitido.'],
};

function handleError(error, req, res, next) {
  const code = error.type === 'entity.parse.failed' ? 'INVALID_JSON'
    : error.type === 'entity.too.large' ? 'REQUEST_TOO_LARGE'
      : error instanceof DocumentError && errors[error.code] ? error.code : 'INTERNAL_ERROR';
  const [status, message] = errors[code] || [500, 'Não foi possível concluir a operação.'];

  if (status >= 500 || res.headersSent) console.error('Falha no DMS:', error);
  if (res.headersSent) {
    res.destroy(error);
    return;
  }
  res.status(status).json({ error: { code, message } });
}

module.exports = handleError;
