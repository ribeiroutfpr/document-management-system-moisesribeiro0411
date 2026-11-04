const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');

process.env.DMS_MAX_FILE_SIZE_BYTES = '64';
process.env.DMS_MAX_STORAGE_BYTES = '1048576';
process.env.DMS_MAX_DOCUMENTS = '6';
process.env.DMS_MAX_UPLOADS_PER_HOUR = '100';
process.env.DMS_ALLOWED_EXTENSIONS = '.PDF,.txt';
process.env.DMS_PROXY_SHARED_SECRET = 'test-proxy-secret-with-at-least-32-bytes';

const app = require('../src/app');
const repository = require('../src/repositories/documents.repository');
const service = require('../src/services/documents.service');
const limitUploads = require('../src/middleware/upload-limits.middleware');
const storageDirectory = path.resolve(__dirname, '../storage');
const catalogPath = path.join(storageDirectory, 'documents.json');

test('API de documentos', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await Promise.all((await repository.findAll()).map(async (document) => {
      try {
        await fs.unlink(path.join(storageDirectory, document.filename));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }));
    await fs.unlink(catalogPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  });
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options = {}) => fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      'x-dms-proxy-secret': process.env.DMS_PROXY_SHARED_SECRET,
      'x-authenticated-user': 'test-instance',
      ...options.headers,
    },
  });
  const unauthenticatedRequest = (url, options) => fetch(`${baseUrl}${url}`, options);
  const sendFile = (name, content = 'documento de teste', field = 'file') => {
    const body = new FormData();
    const data = name.toLowerCase().endsWith('.pdf') && content === 'documento de teste'
      ? `%PDF-1.7\n${content}` : content;
    body.append(field, new Blob([data], { type: 'application/x-untrusted' }), name);
    return request('/upload', { method: 'POST', body });
  };
  const expectError = async (response, status, code) => {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, 'string');
    assert.deepEqual(Object.keys(body), ['error']);
    assert.equal(JSON.stringify(body).includes(storageDirectory), false);
  };
  let document;

  await t.test('preserva health e retorna catálogo vazio', async () => {
    assert.deepEqual(await (await request('/health')).json(), { status: 'ok' });
    assert.deepEqual(await (await request('/documents')).json(), { documents: [] });
  });

  await t.test('grava em disco e retorna somente metadados públicos', async () => {
    const response = await sendFile('relatorio.PDF');
    assert.equal(response.status, 201);
    document = await response.json();
    assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.match(document.id, /^[0-9a-f-]{36}$/);
    assert.equal(document.originalName, 'relatorio.PDF');
    assert.equal(document.owner, 'test-instance');
    assert.equal(document.size, Buffer.byteLength('%PDF-1.7\ndocumento de teste'));
    assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
    const stored = await repository.findById(document.id);
    assert.match(stored.filename, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(await fs.readFile(path.join(storageDirectory, stored.filename), 'utf8'), '%PDF-1.7\ndocumento de teste');
  });

  await t.test('lista em ordem decrescente sem expor dados internos', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await (await sendFile('segundo.txt')).json();
    const response = await request('/documents');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { documents: [second, document] });
  });

  await t.test('contabiliza arquivos órfãos na cota de disco', async () => {
    const orphanPath = path.join(storageDirectory, 'arquivo-orfao.txt');
    await fs.writeFile(orphanPath, Buffer.alloc(1048577));
    try {
      await expectError(await sendFile('cota-disco.txt', 'texto'), 507, 'STORAGE_QUOTA_EXCEEDED');
    } finally {
      await fs.unlink(orphanPath);
    }
    assert.equal((await repository.findAll()).length, 2);
  });

  await t.test('baixa conteúdo com nome original e tipo determinado pela aplicação', async () => {
    const response = await request(`/documents/${document.id}/download`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="relatorio.PDF"');
    assert.equal(Number(response.headers.get('content-length')), document.size);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await response.text(), '%PDF-1.7\ndocumento de teste');
  });

  await t.test('rejeita arquivo ausente, campo errado e múltiplos arquivos', async () => {
    await expectError(await request('/upload', { method: 'POST' }), 400, 'FILE_REQUIRED');
    await expectError(await sendFile('arquivo.txt', 'texto', 'document'), 400, 'INVALID_FILE_FIELD');
    const body = new FormData();
    body.append('file', new Blob(['primeiro']), 'primeiro.txt');
    body.append('file', new Blob(['segundo']), 'segundo.txt');
    await expectError(await request('/upload', { method: 'POST', body }), 400, 'INVALID_FILE_FIELD');
    assert.equal((await repository.findAll()).length, 2);
  });

  await t.test('rejeita extensão inválida e tamanho acima do limite', async () => {
    await expectError(await sendFile('script.exe'), 415, 'FILE_TYPE_NOT_ALLOWED');
    await expectError(await sendFile('sem-extensao'), 415, 'FILE_TYPE_NOT_ALLOWED');
    await expectError(await sendFile('grande.txt', 'a'.repeat(65)), 413, 'FILE_TOO_LARGE');
    assert.equal((await repository.findAll()).length, 2);
  });

  await t.test('aceita tamanho exatamente no limite', async () => {
    assert.equal((await sendFile('limite.txt', 'a'.repeat(64))).status, 201);
  });

  await t.test('nomes repetidos não colidem e nomes do cliente não definem caminhos', async () => {
    const first = await (await sendFile('../../mesmo.txt', 'primeiro')).json();
    const second = await (await sendFile('mesmo.txt', 'segundo')).json();
    const firstStored = await repository.findById(first.id);
    const secondStored = await repository.findById(second.id);
    assert.notEqual(first.id, second.id);
    assert.notEqual(firstStored.filename, secondStored.filename);
    assert.match(firstStored.filename, /^[0-9a-f-]{36}\.txt$/);
    assert.equal(first.originalName, 'mesmo.txt');
    assert.equal(await (await request(`/documents/${first.id}/download`)).text(), 'primeiro');
    assert.equal(await (await request(`/documents/${second.id}/download`)).text(), 'segundo');
  });

  await t.test('codifica com segurança nomes no cabeçalho de download', async () => {
    const boundary = 'dms-test-boundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="relatorio \\"final\\".txt"',
      'Content-Type: text/plain', '', 'conteudo', `--${boundary}--`, '',
    ].join('\r\n');
    const uploaded = await (await request('/upload', {
      method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body,
    })).json();
    assert.equal(uploaded.originalName, 'relatorio "final".txt');
    const response = await request(`/documents/${uploaded.id}/download`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /filename="relatorio \\"final\\".txt"/);
    await response.arrayBuffer();
  });

  await t.test('impede uploads que ultrapassariam a cota de documentos', async () => {
    assert.equal((await repository.findAll()).length, 6);
    await expectError(await sendFile('cota.txt', 'mais um'), 507, 'STORAGE_QUOTA_EXCEEDED');
    assert.equal((await repository.findAll()).length, 6);
  });

  await t.test('rejeita multipart malformado', async () => {
    await expectError(await request('/upload', {
      method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'inválido',
    }), 400, 'INVALID_UPLOAD');
  });

  await t.test('mantém o status de erro de JSON malformado', async () => {
    await expectError(await request('/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    }), 400, 'INVALID_JSON');
  });

  await t.test('valida identificador e retorna 404 para documento ausente', async () => {
    await expectError(await request('/documents/invalido/download'), 400, 'INVALID_DOCUMENT_ID');
    await expectError(await request(`/documents/${randomUUID()}/download`), 404, 'DOCUMENT_NOT_FOUND');
  });

  await t.test('retorna 404 para arquivo removido do disco', async () => {
    await fs.unlink(path.join(storageDirectory, (await repository.findById(document.id)).filename));
    await expectError(await request(`/documents/${document.id}/download`), 404, 'FILE_NOT_FOUND');
  });

  await t.test('exige o proxy confiável e não permite acesso cruzado entre usuários', async () => {
    await expectError(await unauthenticatedRequest('/documents'), 401, 'UNAUTHORIZED');
    await expectError(await fetch(`${baseUrl}/documents`, {
      headers: {
        'x-dms-proxy-secret': 'wrong-proxy-secret-with-at-least-32-bytes',
        'x-authenticated-user': 'test-instance',
      },
    }), 401, 'UNAUTHORIZED');
    const otherUserRequest = (url) => fetch(`${baseUrl}${url}`, {
      headers: {
        'x-dms-proxy-secret': process.env.DMS_PROXY_SHARED_SECRET,
        'x-authenticated-user': 'other-user',
      },
    });
    assert.deepEqual(await (await otherUserRequest('/documents')).json(), { documents: [] });
    await expectError(
      await otherUserRequest(`/documents/${document.id}/download`),
      404,
      'DOCUMENT_NOT_FOUND',
    );
  });

  await t.test('retorna erros JSON para rotas inexistentes', async () => {
    await expectError(await request('/rota-inexistente'), 404, 'ROUTE_NOT_FOUND');
  });

  await t.test('rejeita conteúdo incompatível e remove o arquivo temporário', async () => {
    const before = (await fs.readdir(storageDirectory)).length;
    await expectError(await sendFile('falso.pdf', 'texto sem assinatura'), 415, 'FILE_CONTENT_INVALID');
    await expectError(await sendFile('falso.txt', Buffer.from([0xff, 0x00])), 415, 'FILE_CONTENT_INVALID');
    assert.equal((await fs.readdir(storageDirectory)).length, before);
  });

  await t.test('trata e registra falhas de disco sem expor detalhes', async (t) => {
    const logs = t.mock.method(console, 'error', () => {});
    const mkdir = t.mock.method(fs, 'mkdir', async () => {
      throw Object.assign(new Error('caminho interno confidencial'), { code: 'EACCES' });
    });
    const count = (await repository.findAll()).length;
    await expectError(await sendFile('falha.txt'), 500, 'STORAGE_WRITE_FAILED');
    assert.equal((await repository.findAll()).length, count);
    mkdir.mock.restore();
    t.mock.method(fs, 'lstat', async () => {
      throw Object.assign(new Error('caminho interno confidencial'), { code: 'EACCES' });
    });
    await expectError(await request(`/documents/${document.id}/download`), 500, 'STORAGE_READ_FAILED');
    assert.equal(logs.mock.callCount(), 2);
  });

  await t.test('reinício reabre o catálogo persistido', async () => {
    const child = spawnSync(process.execPath, ['-e',
      "require('./src/services/documents.service').listDocuments('test-instance').then((docs) => process.stdout.write(JSON.stringify(docs)));",
    ], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.ok(JSON.parse(child.stdout).length > 0);
    assert.ok((await service.listDocuments('test-instance')).length > 0);
  });

  await t.test('catálogo corrompido falha explicitamente sem reiniciar vazio', async () => {
    const catalog = await fs.readFile(catalogPath);
    await fs.writeFile(catalogPath, '{');
    try {
      const child = spawnSync(process.execPath, ['-e',
        "require('./src/services/documents.service').listDocuments('test-instance');",
      ], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
      assert.notEqual(child.status, 0);
    } finally {
      await fs.writeFile(catalogPath, catalog);
    }
  });
});

test('limita tentativas de upload por usuário', () => {
  const request = { user: { id: 'rate-limit-test' } };
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    limitUploads(request, null, (error) => { lastError = error; });
  }
  assert.equal(lastError, undefined);
  limitUploads(request, null, (error) => { lastError = error; });
  assert.equal(lastError.code, 'UPLOAD_RATE_LIMITED');
});

test('configuração inválida impede a inicialização', () => {
  for (const [name, value] of [
    ['DMS_MAX_FILE_SIZE_BYTES', '0'],
    ['DMS_MAX_FILE_SIZE_BYTES', '1.5'],
    ['DMS_ALLOWED_EXTENSIONS', '.pdf,../txt'],
    ['DMS_ALLOWED_EXTENSIONS', '.pdf,.zip'],
    ['DMS_ALLOWED_EXTENSIONS', ''],
    ['DMS_MAX_STORAGE_BYTES', '0'],
    ['DMS_MAX_DOCUMENTS', 'invalid'],
    ['DMS_PROXY_SHARED_SECRET', 'short'],
  ]) {
    const child = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, [name]: value },
      encoding: 'utf8',
    });
    assert.notEqual(child.status, 0);
    assert.ok(child.stderr.includes(name));
  }
});

test('desativa rotas de documentos quando o segredo do proxy não está configurado', () => {
  const script = [
    "const app = require('./src/app');",
    "const server = app.listen(0, '127.0.0.1', async () => {",
    "  const response = await fetch('http://127.0.0.1:' + server.address().port + '/documents');",
    "  process.stdout.write(JSON.stringify({ status: response.status, body: await response.json() }));",
    "  server.close();",
    '});',
  ].join('\n');
  const env = { ...process.env };
  delete env.DMS_PROXY_SHARED_SECRET;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    status: 503,
    body: { error: { code: 'PROXY_AUTH_NOT_CONFIGURED', message: 'Autenticação do proxy não configurada.' } },
  });
});
