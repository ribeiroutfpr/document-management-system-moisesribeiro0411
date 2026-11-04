import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

test('lista documentos via /api e encaminha o sinal de cancelamento', async (t) => {
  const documents = [{
    id: '550e8400-e29b-41d4-a716-446655440000',
    originalName: 'relatorio.txt',
    size: 12,
    uploadedAt: '2026-11-04T12:00:00.000Z',
    owner: 'test-user',
  }];
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/documents');
    assert.equal(options.signal, signal);
    return Response.json({ documents });
  });
  assert.deepEqual(await listDocuments({ signal }), documents);
});

test('aceita uma lista vazia', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ documents: [] }));
  assert.deepEqual(await listDocuments(), []);
});

test('envia multipart com um arquivo no campo file sem forçar Content-Type', async (t) => {
  const file = new File(['conteudo'], 'relatorio.txt', { type: 'text/plain' });
  const document = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    originalName: file.name,
    size: 8,
    uploadedAt: '2026-11-04T12:00:00.000Z',
    owner: 'test-user',
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers, undefined);
    assert.deepEqual([...options.body.keys()], ['file']);
    assert.equal(options.body.get('file').name, file.name);
    assert.equal(await options.body.get('file').text(), 'conteudo');
    return Response.json(document, { status: 201 });
  });
  assert.deepEqual(await uploadDocument(file), document);
});

test('baixa o conteúdo binário e codifica o identificador na URL', async (t) => {
  const bytes = new Uint8Array([0, 255, 10, 128]);
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, '/api/documents/id%2Fespecial/download');
    return new Response(bytes);
  });
  const blob = await downloadDocument('id/especial');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

for (const [name, operation] of [
  ['listagem', () => listDocuments()],
  ['upload', () => uploadDocument(new File(['x'], 'arquivo.txt'))],
  ['download', () => downloadDocument('document-id')],
]) {
  test(`propaga a mensagem de erro do backend na operação de ${name}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({
      error: { code: 'DOCUMENT_ERROR', message: 'Operação rejeitada pelo servidor.' },
    }, { status: 400 }));
    await assert.rejects(operation, { message: 'Operação rejeitada pelo servidor.' });
  });
}

test('reporta erro HTTP mesmo quando o proxy não retorna JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }));
  await assert.rejects(listDocuments(), /HTTP 502/);
});

test('reporta falha de rede em português', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(listDocuments(), /Não foi possível conectar ao servidor/);
});

test('preserva cancelamento da requisição', async (t) => {
  const error = new DOMException('Cancelado', 'AbortError');
  t.mock.method(globalThis, 'fetch', async () => { throw error; });
  await assert.rejects(listDocuments(), (actual) => actual === error);
});

test('rejeita respostas JSON malformadas', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{'));
  await assert.rejects(listDocuments(), /resposta JSON inválida/);
});

test('rejeita formato de listagem inesperado em vez de mostrar uma lista vazia', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ documents: null }));
  await assert.rejects(listDocuments(), /lista de documentos inválida/);
});

test('rejeita metadados incompletos na listagem', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    documents: [{ id: 'document-id', originalName: 'arquivo.txt' }],
  }));
  await assert.rejects(listDocuments(), /lista de documentos inválida/);
});

test('rejeita metadados incompletos no upload', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'document-id' }, { status: 201 }));
  await assert.rejects(uploadDocument(new File(['x'], 'arquivo.txt')), /documento inválido/);
});
