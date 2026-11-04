import { useEffect, useState } from 'react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';
import { listDocuments } from './services/api.js';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  function refreshDocuments() {
    setRefreshKey((key) => key + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    async function loadDocuments() {
      try {
        const documents = await listDocuments({ signal: controller.signal });
        if (!controller.signal.aborted) setDocuments(documents);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadDocuments();
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Document Management System</h1>
      <UploadComponent onUploadSuccess={refreshDocuments} />
      <section aria-labelledby="documents-title" aria-busy={isLoading}>
        <h2 id="documents-title">Documentos</h2>
        <button type="button" onClick={refreshDocuments} disabled={isLoading}>
          Atualizar lista
        </button>
        {isLoading && <p role="status">Carregando documentos...</p>}
        {error && <p role="alert">{error}</p>}
        {(!isLoading && !error || documents.length > 0) && (
          <DocumentList documents={documents} />
        )}
      </section>
    </main>
  );
}
