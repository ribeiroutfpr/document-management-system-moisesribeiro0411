import { useState } from 'react';
import { uploadDocument } from '../services/api.js';

export default function UploadComponent({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (isUploading) return;
    setError('');
    setSuccess('');
    if (!file) {
      setError('Selecione um arquivo para enviar.');
      return;
    }

    const form = event.currentTarget;
    setIsUploading(true);
    try {
      await uploadDocument(file);
      form.reset();
      setFile(null);
      setSuccess('Documento enviado com sucesso.');
      onUploadSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section aria-labelledby="upload-title">
      <h2 id="upload-title">Enviar documento</h2>
      <form onSubmit={handleSubmit} aria-busy={isUploading}>
        <label htmlFor="document-file">Arquivo </label>
        <input
          id="document-file"
          name="file"
          type="file"
          required
          disabled={isUploading}
          onChange={(event) => {
            setFile(event.target.files[0] ?? null);
            setError('');
            setSuccess('');
          }}
        />
        <button type="submit" disabled={isUploading || !file}>
          {isUploading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
