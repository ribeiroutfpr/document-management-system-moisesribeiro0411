const { timingSafeEqual } = require('node:crypto');
const { proxySharedSecret } = require('../config');
const DocumentError = require('../errors');

function authenticateProxy(req, res, next) {
  if (!proxySharedSecret) {
    return next(new DocumentError(
      'PROXY_AUTH_NOT_CONFIGURED',
      'Autenticação do proxy não configurada.',
    ));
  }

  const suppliedSecret = req.get('x-dms-proxy-secret') || '';
  const expected = Buffer.from(proxySharedSecret);
  const supplied = Buffer.from(suppliedSecret);
  const secretMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  const owner = req.get('x-authenticated-user')?.trim();
  if (!secretMatches || !owner || owner.length > 128 || /[\r\n]/.test(owner)) {
    return next(new DocumentError('UNAUTHORIZED', 'Autenticação necessária.'));
  }

  req.user = { id: owner };
  next();
}

module.exports = authenticateProxy;
