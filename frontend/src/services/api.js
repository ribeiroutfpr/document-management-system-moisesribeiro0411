async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error('O servidor retornou uma resposta JSON inválida.', { cause: error });
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.', { cause: error });
  }

  if (!response.ok) {
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await readJson(response)
      : null;
    throw new Error(data?.error?.message || `Não foi possível concluir a operação (HTTP ${response.status}).`);
  }

  return response;
}

export async function listDocuments({ signal } = {}) {
  const response = await request('/documents', { signal });
  const data = await readJson(response);
  if (!Array.isArray(data.documents)) {
    throw new Error('O servidor retornou uma lista de documentos inválida.');
  }
  return data.documents;
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', { method: 'POST', body });
  return readJson(response);
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}
