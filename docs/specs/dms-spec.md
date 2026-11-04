# Especificação - Document Management System

> Contratos e decisões atuais do MVP. Os requisitos abaixo refletem a implementação existente.

## 1. Objetivo

Entregar uma aplicação web simples para enviar, listar e baixar documentos armazenados no filesystem local, com catálogo persistido localmente e acesso isolado pela identidade autenticada no proxy reverso confiável.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos enviados para a instância local.
- Download de um documento pelo identificador.
- Interface React para upload, listagem e download.
- Identificação do dono a partir de uma identidade validada pelo proxy reverso; não há tela de login ou cadastro local.
- Armazenamento dos arquivos em `backend/storage` com Multer e `diskStorage`.
- Persistência local dos metadados em `backend/storage/documents.json`.
- Validação de assinatura básica do conteúdo, cotas locais e limitação de frequência de upload.

### Fora do escopo

- Login, cadastro e gerenciamento local de usuários.
- Armazenamento externo, em nuvem ou em banco de dados.
- Versionamento, edição, exclusão ou compartilhamento de documentos.
- Upload de múltiplos arquivos em uma única requisição.
- Antivírus, OCR, indexação ou busca no conteúdo dos arquivos.

### Estado atual e escopo planejado

O backend expõe `GET /health` e os três endpoints de documentos descritos nesta especificação, com armazenamento local e catálogo JSON persistido. O frontend oferece upload, listagem de metadados e download, com estados de carregamento, vazio, sucesso e erro, atualização automática após upload e atualização manual da lista. Os endpoints de documentos exigem segredo compartilhado com o proxy e identidade autenticada; a listagem e o download são restritos ao dono. O proxy Vite encaminha `/api` ao backend e remove esse prefixo. `GET /health` permanece público para verificação básica.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve aceitar um arquivo por requisição no campo `file` de `multipart/form-data`. |
| RF-02 | O sistema deve rejeitar requisições sem arquivo, com campo incorreto, extensão não permitida, assinatura incompatível ou arquivo acima do limite configurado, retornando erro identificável ao cliente. |
| RF-03 | O sistema deve gravar o arquivo exclusivamente no filesystem local em `backend/storage`, usando Multer com `diskStorage`; não deve enviar arquivos a serviços externos. |
| RF-04 | O sistema deve gerar um identificador UUID e um nome físico de armazenamento não derivado diretamente do nome fornecido pelo cliente, preservando a extensão permitida necessária para identificar o formato. |
| RF-05 | Após validar o conteúdo e gravar o arquivo, o sistema deve persistir atomicamente os metadados no catálogo local e retornar os metadados públicos. Falhas não podem deixar documento anunciado sem arquivo válido. |
| RF-06 | O sistema deve listar somente documentos do usuário autenticado, em ordem decrescente de `uploadedAt`; lista vazia deve ser retornada como sucesso com coleção vazia. |
| RF-07 | O sistema deve permitir baixar somente documentos do usuário autenticado pelo `id`, transmitindo o conteúdo como anexo e usando o nome original com codificação segura no cabeçalho. |
| RF-08 | O sistema deve retornar erro `404` quando o identificador não estiver no catálogo ou quando o arquivo associado não existir no disco; não deve expor caminhos internos. |
| RF-09 | O sistema deve atribuir `owner` à identidade enviada pelo proxy confiável após validar o segredo compartilhado. |
| RF-10 | A interface deve permitir selecionar e enviar um arquivo, apresentar estado de carregamento, sucesso ou erro, listar documentos, indicar estado vazio e iniciar o download de cada documento. |
| RF-11 | A interface deve consumir os endpoints pelo prefixo `/api`, usando o proxy do Vite; o backend mantém os caminhos canônicos sem esse prefixo. |
| RF-12 | Após reiniciar o backend, o sistema deve recarregar e validar o catálogo persistido; catálogo inválido deve falhar explicitamente, sem iniciar vazio. |

### Política inicial de upload

Como política inicial recomendada e ajustável por ambiente, o limite é 10 MiB por arquivo e as extensões permitidas são `.pdf`, `.doc`, `.docx`, `.txt`, `.csv`, `.xls`, `.xlsx`, `.ppt` e `.pptx`. A comparação de extensão deve ignorar diferença entre maiúsculas e minúsculas. A lista é validada na inicialização; configuração inválida deve impedir o serviço de iniciar. A aplicação não deve confiar exclusivamente no `Content-Type` informado pelo cliente para decidir a extensão ou construir um caminho.

Além da allowlist, o backend verifica assinaturas básicas compatíveis com a extensão; isso não substitui validação estrutural completa nem análise antivírus. A aplicação não executa scanner antimalware. O limite agregado de armazenamento e a quantidade de documentos também são configuráveis.

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem permanecer no filesystem local em `backend/storage`, gravados por Multer `diskStorage`; armazenamento externo é proibido neste MVP. |
| RNF-02 | Metadados devem ser persistidos em arquivo JSON local com substituição atômica; arquivos e catálogo devem ser incluídos em backups consistentes. |
| RNF-03 | Configurações operacionais devem ser lidas de variáveis de ambiente, com padrões documentados. |
| RNF-04 | O backend deve manter dependências na direção `routes -> controllers -> services -> repositories`; regras de negócio não devem depender de Express, Multer ou detalhes do filesystem. |
| RNF-05 | Erros de entrada devem ser tratados na fronteira HTTP; falhas de filesystem não devem expor stack trace, caminho local ou detalhes internos ao cliente. |
| RNF-06 | Nomes enviados por clientes não podem ser usados como caminho físico. A aplicação deve prevenir traversal de diretório, colisão de nomes e injeção de cabeçalhos, e usar identificadores aleatórios para os arquivos armazenados. |
| RNF-07 | A listagem e as respostas JSON devem usar UTF-8. `uploadedAt` deve ser UTC em formato ISO 8601. |
| RNF-08 | O frontend deve usar componentes funcionais React e `fetch`, com mensagens de interface em português e estados acessíveis de carregamento, vazio e erro. |
| RNF-09 | O catálogo JSON e o limitador de uploads são locais ao processo; executar múltiplas réplicas não é suportado sem um mecanismo externo de coordenação e armazenamento compartilhado. |

### Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `DMS_MAX_FILE_SIZE_BYTES` | `10485760` | Limite de tamanho por arquivo, em bytes (10 MiB). Deve ser inteiro positivo. |
| `DMS_ALLOWED_EXTENSIONS` | `.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx` | Allowlist separada por vírgula; normalizada para minúsculas. |
| `DMS_MAX_STORAGE_BYTES` | `1073741824` | Cota total de arquivos regulares no diretório local, incluindo órfãos, em bytes (1 GiB). |
| `DMS_MAX_DOCUMENTS` | `1000` | Quantidade máxima de documentos catalogados. |
| `DMS_MAX_UPLOADS_PER_HOUR` | `30` | Máximo de tentativas de upload por usuário em uma janela móvel de uma hora. |
| `DMS_PROXY_SHARED_SECRET` | sem padrão; necessário para rotas de documentos | Segredo aleatório de pelo menos 32 bytes, compartilhado somente entre backend e proxy. Sem configuração, rotas de documentos retornam `503`. |

O diretório de armazenamento permanece fixo em `backend/storage` conforme a restrição do projeto. Configurações numéricas inválidas e segredo fraco impedem a inicialização.

## 5. Modelo de dados (metadados do documento)

### Metadados públicos

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | UUID único do documento, usado nos endpoints de listagem e download. |
| `originalName` | string | Nome original fornecido no upload, apenas metadado e nome sugerido no download. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Data/hora UTC em ISO 8601, por exemplo `2026-11-04T12:00:00.000Z`. |
| `owner` | string | Identidade autenticada fornecida pelo proxy e usada para isolamento de listagem e download. |

### Dados internos do repositório

O catálogo JSON deve manter, além dos campos públicos, o nome físico gerado para o arquivo e o tipo de conteúdo determinado pela aplicação. Esses dados internos não devem ser serializados na API. O caminho absoluto deve ser resolvido a partir do diretório local configurado no código, nunca aceito do cliente nem retornado nas respostas.

Não há banco de dados. O catálogo é carregado para um mapa em memória e persistido por substituição atômica do JSON. A escrita do arquivo deve terminar antes do registro dos metadados; se a validação ou persistência falhar, a aplicação deve tentar remover o arquivo recém-criado.

## 6. Contratos de API

Os caminhos nesta seção são canônicos no backend. O frontend os consome com o prefixo `/api` pelo proxy Vite. Os erros JSON usam `Content-Type: application/json; charset=utf-8` e o formato comum abaixo:

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo no campo file."
  }
}
```

`code` é estável para tratamento pelo frontend; `message` é uma mensagem legível em português. Respostas de erro não devem conter stack trace ou caminho local.

### POST /upload

- **Entrada:** `multipart/form-data`, exatamente um arquivo no campo `file`.
- **Validação:** arquivo obrigatório; extensão presente na allowlist; assinatura compatível; tamanho até `DMS_MAX_FILE_SIZE_BYTES`; cotas e frequência respeitadas. Requisições com arquivo ausente ou campo não esperado são inválidas.
- **Sucesso:** `201 Created`, JSON com os metadados públicos do documento criado.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "relatorio.pdf",
  "size": 24576,
  "uploadedAt": "2026-11-04T12:00:00.000Z",
  "owner": "usuario-autenticado"
}
```

- **Erros:** `400 Bad Request` para arquivo/campo inválido; `401 Unauthorized` para autenticação inválida; `413 Payload Too Large` para limite por arquivo excedido; `415 Unsupported Media Type` para extensão ou assinatura incompatível; `429 Too Many Requests` para limite de frequência; `507 Insufficient Storage` para cota agregada; `500 Internal Server Error` para falha de gravação.
- **Códigos principais:** `FILE_REQUIRED`, `INVALID_FILE_FIELD`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `FILE_CONTENT_INVALID`, `UPLOAD_RATE_LIMITED`, `STORAGE_QUOTA_EXCEEDED`, `STORAGE_WRITE_FAILED`.

Todos os endpoints de documento exigem `x-dms-proxy-secret` e `x-authenticated-user`, adicionados pelo proxy reverso confiável. O proxy deve remover cabeçalhos homônimos enviados pelo cliente e preencher a identidade somente após autenticar o usuário. Não exponha o backend diretamente à rede pública. `GET /health` não exige autenticação.

### GET /documents

- **Entrada:** sem parâmetros ou corpo.
- **Sucesso:** `200 OK`, JSON contendo somente documentos do usuário autenticado, ordenados por `uploadedAt` decrescente. Não há paginação no MVP.

```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "uploadedAt": "2026-11-04T12:00:00.000Z",
      "owner": "usuario-autenticado"
    }
  ]
}
```

- **Lista vazia:** `200 OK` com `{"documents": []}`.
- **Erro:** `401 Unauthorized` sem credenciais válidas do proxy; `500 Internal Server Error` se o catálogo persistido estiver inválido ou não puder ser lido.

### GET /documents/:id/download

- **Entrada:** `id` UUID na URL.
- **Sucesso:** `200 OK` somente para documento do usuário autenticado, corpo binário transmitido como anexo, `Content-Disposition: attachment` com o nome original codificado com segurança, `X-Content-Type-Options: nosniff` e `Content-Type` determinado pela aplicação a partir da extensão e assinatura validada. Enviar `Content-Length` quando conhecido.
- **Erros:** `400 Bad Request` para identificador malformado; `404 Not Found` para documento ou arquivo inexistente; `500 Internal Server Error` para falha de leitura antes do início da resposta. Se ocorrer falha após o início do streaming, encerrar a transmissão e registrar a falha sem tentar escrever uma resposta JSON parcial.
- **Códigos de erro sugeridos:** `INVALID_DOCUMENT_ID`, `DOCUMENT_NOT_FOUND`, `FILE_NOT_FOUND`, `STORAGE_READ_FAILED`.

### Endpoint operacional existente

`GET /health` retorna `200 OK` com `{"status":"ok"}` no backend atual. Deve continuar disponível para verificação básica do processo; não verifica a existência de documentos individuais nem oferece garantias de disponibilidade do filesystem.

## 7. Decisões arquiteturais

### Backend (Clean Architecture simples)

- Manter Node.js, Express e CommonJS.
- `routes/`: declarar caminhos, instalar o middleware Multer e delegar para controllers. Multer usa `diskStorage` e escreve somente em `backend/storage`.
- `controllers/`: traduzir request/response HTTP, validar formato básico da entrada e mapear erros conhecidos para status e JSON; não conter regras de negócio nem acesso direto ao filesystem.
- `services/`: aplicar regras de upload, listagem e download, gerar identificadores e coordenar repositório e armazenamento.
- `repositories/`: encapsular o catálogo JSON local e a localização/leitura do arquivo. Não usar banco ou serviço externo.
- Dependências devem apontar para dentro conforme `routes -> controllers -> services -> repositories`; camadas internas não devem importar Express.
- Registrar as rotas no app Express existente e preservar `GET /health`.

### Frontend

- Manter React + Vite, componentes funcionais e organização em `components/`, `pages/` e `services/`.
- Centralizar chamadas `fetch` à API no serviço de frontend e usar o prefixo `/api`.
- A tela principal deve cobrir seleção/upload de um arquivo, lista com nome/tamanho/data, download, lista vazia e erros retornados pela API.
- A autenticação é delegada a um proxy reverso confiável; o frontend não recebe nem armazena o segredo compartilhado.

### Armazenamento e recuperação

- Multer com `diskStorage` grava arquivo físico localmente; nenhum provedor de upload ou armazenamento externo é permitido.
- O nome físico é gerado pela aplicação com UUID e extensão validada. O nome original não é usado para compor o caminho.
- Metadados são persistidos no arquivo local `backend/storage/documents.json` e recarregados na inicialização. Arquivos sem referência podem permanecer após falhas e a limpeza automatizada não faz parte deste MVP.
- Operações devem tratar falhas de disco explicitamente. O backend não deve anunciar sucesso antes da gravação completa do arquivo.
- Backup e restauração devem abranger o catálogo JSON e os arquivos físicos em conjunto. O catálogo e o limitador são destinados a uma única instância de backend.

## 8. Limitações operacionais

- O proxy reverso é responsável pelo login real; o backend confia apenas no segredo compartilhado e na identidade fornecida pelo proxy. O segredo não pode ser enviado ao navegador.
- A validação de conteúdo verifica assinaturas e texto UTF-8, mas não inspeciona completamente arquivos compactados nem substitui um scanner antivírus.
- Catálogo, cotas e limitação de frequência são locais ao processo; implantação com múltiplas réplicas requer coordenação adicional.
- Arquivos órfãos são contabilizados na cota de disco, mas não são removidos automaticamente.
