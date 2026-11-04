import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import DownloadButton from '../src/components/DownloadButton.jsx';

const sampleDocument = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  originalName: 'relatorio.txt',
  size: 12,
  uploadedAt: '2026-11-04T12:00:00.000Z',
  owner: 'test-user',
};

function jsonResponse(body, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    blob: async () => new Blob(['conteudo']),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fluxos dos componentes', () => {
  it('envia arquivo pela tela e atualiza a lista após sucesso', async () => {
    let documents = [];
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      requests.push(url);
      if (url === '/api/documents') return jsonResponse({ documents });
      if (url === '/api/upload') {
        expect(options.body.get('file').name).toBe('relatorio.txt');
        documents = [sampleDocument];
        return jsonResponse(sampleDocument, 201);
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(App));
    await screen.findByText('Nenhum documento enviado.');
    await userEvent.upload(screen.getByLabelText('Arquivo'), new File(['conteudo'], 'relatorio.txt'));
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form'));

    expect(fetchMock).toHaveBeenCalled();
    expect(requests).toContain('/api/upload');
    expect(await screen.findByText('Documento enviado com sucesso.')).toBeTruthy();
    expect(await screen.findByText('relatorio.txt')).toBeTruthy();
    expect(requests.filter((url) => url === '/api/documents')).toHaveLength(2);
  });

  it('apresenta falha do upload sem marcar sucesso', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/documents') return jsonResponse({ documents: [] });
      return jsonResponse({ error: { message: 'Arquivo rejeitado.' } }, 415);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(App));
    await screen.findByText('Nenhum documento enviado.');
    await userEvent.upload(screen.getByLabelText('Arquivo'), new File(['conteudo'], 'arquivo.txt'));
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form'));

    expect(fetchMock).toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toBe('Arquivo rejeitado.');
    expect(screen.queryByText('Documento enviado com sucesso.')).toBeNull();
  });

  it('aciona o download e libera a URL temporária', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
    const objectUrl = {
      createObjectURL: vi.fn(() => 'blob:test-document'),
      revokeObjectURL: vi.fn(),
    };
    vi.stubGlobal('URL', objectUrl);
    const clicked = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(React.createElement(DownloadButton, { document: sampleDocument }));
    await userEvent.click(screen.getByRole('button', { name: 'Baixar relatorio.txt' }));
    await waitFor(() => expect(clicked).toHaveBeenCalledOnce());
    await waitFor(() => expect(objectUrl.revokeObjectURL).toHaveBeenCalledOnce());
    expect(objectUrl.createObjectURL).toHaveBeenCalledOnce();
  });
});
