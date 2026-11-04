import DownloadButton from './DownloadButton.jsx';

export default function DocumentList({ documents }) {
  if (documents.length === 0) {
    return <p>Nenhum documento enviado.</p>;
  }

  return (
    <table>
      <caption>Documentos disponíveis para download</caption>
      <thead>
        <tr>
          <th scope="col">Nome</th>
          <th scope="col">Tamanho</th>
          <th scope="col">Data de envio</th>
          <th scope="col">Dono</th>
          <th scope="col">Download</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((document) => (
          <tr key={document.id}>
            <td>{document.originalName}</td>
            <td>{document.size.toLocaleString('pt-BR')} bytes</td>
            <td>
              <time dateTime={document.uploadedAt}>
                {new Date(document.uploadedAt).toLocaleString('pt-BR')}
              </time>
            </td>
            <td>{document.owner}</td>
            <td><DownloadButton document={document} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
