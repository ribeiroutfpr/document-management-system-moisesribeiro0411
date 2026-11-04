# Especificação - Document Management System

> Especificação do MVP para orientar o desenvolvimento. Os comportamentos descritos como requisitos são planejados; não devem ser interpretados como já implementados.

## 1. Objetivo

Entregar uma aplicação web simples para enviar, listar e baixar documentos armazenados no filesystem local, com metadados mantidos em memória e sem autenticação no MVP.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos enviados para a instância local.
- Download de um documento pelo identificador.
- Interface React para upload, listagem e download.
- Identificação simples do dono por uma configuração da instância, sem login ou isolamento de acesso.
- Armazenamento dos arquivos em `backend/storage` com Multer e `diskStorage`.
- Armazenamento dos metadados em memória durante a vida do processo.

### Fora do escopo

- Autenticação, autorização e isolamento de documentos entre usuários.
- Armazenamento externo, em nuvem ou em banco de dados.
- Persistência ou reconstrução dos metadados após reiniciar o backend.
- Versionamento, edição, exclusão ou compartilhamento de documentos.
- Upload de múltiplos arquivos em uma única requisição.
- Antivírus, OCR, indexação ou busca no conteúdo dos arquivos.

### Estado atual e escopo planejado

O backend atual expõe `GET /health`; os endpoints de documentos e as telas descritos nesta especificação são requisitos futuros. O frontend atual ainda não oferece os fluxos do DMS. O proxy Vite existente encaminha `/api` ao backend e remove esse prefixo. `GET /health` é um endpoint operacional existente, não substitui os contratos de documentos abaixo.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve aceitar um arquivo por requisição no campo `file` de `multipart/form-data`. |
| RF-02 | O sistema deve rejeitar requisições sem arquivo, com campo incorreto, extensão não permitida ou arquivo acima do limite configurado, retornando erro identificável ao cliente. |
| RF-03 | O sistema deve gravar o arquivo exclusivamente no filesystem local em `backend/storage`, usando Multer com `diskStorage`; não deve enviar arquivos a serviços externos. |
| RF-04 | O sistema deve gerar um identificador UUID e um nome físico de armazenamento não derivado diretamente do nome fornecido pelo cliente, preservando a extensão permitida necessária para identificar o formato. |
| RF-05 | Após gravar o arquivo com sucesso, o sistema deve registrar em memória os metadados do documento e retornar os metadados públicos. Não deve registrar um documento cuja gravação falhou. |
| RF-06 | O sistema deve listar todos os documentos conhecidos pela instância, em ordem decrescente de `uploadedAt`; lista vazia deve ser retornada como sucesso com coleção vazia. |
| RF-07 | O sistema deve permitir baixar um documento existente pelo `id`, transmitindo o conteúdo como anexo e usando o nome original com codificação segura no cabeçalho de download. |
| RF-08 | O sistema deve retornar erro `404` quando o identificador não estiver no catálogo ou quando o arquivo associado não existir no disco; não deve expor caminhos internos. |
| RF-09 | O sistema deve atribuir `owner` a partir da configuração `DMS_DEFAULT_OWNER`. Esse valor representa a instância inteira, não uma identidade autenticada. |
| RF-10 | A interface deve permitir selecionar e enviar um arquivo, apresentar estado de carregamento, sucesso ou erro, listar documentos, indicar estado vazio e iniciar o download de cada documento. |
| RF-11 | A interface deve consumir os endpoints pelo prefixo `/api`, usando o proxy do Vite; o backend mantém os caminhos canônicos sem esse prefixo. |
| RF-12 | Após reiniciar o backend, o catálogo em memória deve iniciar vazio. Arquivos remanescentes no diretório local não devem ser automaticamente reindexados. |

### Política inicial de upload

Como política inicial recomendada e ajustável por ambiente, o limite é 10 MiB por arquivo e as extensões permitidas são `.pdf`, `.doc`, `.docx`, `.txt`, `.csv`, `.xls`, `.xlsx`, `.ppt` e `.pptx`. A comparação de extensão deve ignorar diferença entre maiúsculas e minúsculas. A lista é validada na inicialização; configuração inválida deve impedir o serviço de iniciar. A aplicação não deve confiar exclusivamente no `Content-Type` informado pelo cliente para decidir a extensão ou construir um caminho.

O MVP aceita apenas arquivos com extensão na allowlist. O limite e a allowlist são configurações, não garantias de detecção de conteúdo malicioso; varredura antivírus não faz parte deste escopo.

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem permanecer no filesystem local em `backend/storage`, gravados por Multer `diskStorage`; armazenamento externo é proibido neste MVP. |
| RNF-02 | Metadados devem ser mantidos somente em memória. Reinícios perdem o catálogo; arquivos órfãos não são recuperados automaticamente. |
| RNF-03 | Configurações operacionais devem ser lidas de variáveis de ambiente, com padrões documentados. |
| RNF-04 | O backend deve manter dependências na direção `routes -> controllers -> services -> repositories`; regras de negócio não devem depender de Express, Multer ou detalhes do filesystem. |
| RNF-05 | Erros de entrada devem ser tratados na fronteira HTTP; falhas de filesystem não devem expor stack trace, caminho local ou detalhes internos ao cliente. |
| RNF-06 | Nomes enviados por clientes não podem ser usados como caminho físico. A aplicação deve prevenir traversal de diretório, colisão de nomes e injeção de cabeçalhos, e usar identificadores aleatórios para os arquivos armazenados. |
| RNF-07 | A listagem e as respostas JSON devem usar UTF-8. `uploadedAt` deve ser UTC em formato ISO 8601. |
| RNF-08 | O frontend deve usar componentes funcionais React e `fetch`, com mensagens de interface em português e estados acessíveis de carregamento, vazio e erro. |
| RNF-09 | O armazenamento local e os metadados em memória são adequados apenas ao escopo inicial de instância única; não há garantia de catálogo persistente, alta disponibilidade ou compartilhamento entre réplicas. |

### Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `DMS_MAX_FILE_SIZE_BYTES` | `10485760` | Limite de tamanho por arquivo, em bytes (10 MiB). Deve ser inteiro positivo. |
| `DMS_ALLOWED_EXTENSIONS` | `.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx` | Allowlist separada por vírgula; normalizada para minúsculas. |
| `DMS_DEFAULT_OWNER` | `local-instance` | Identificador fixo atribuído como dono dos documentos desta instância. |

O diretório de armazenamento permanece fixo em `backend/storage` conforme a restrição do projeto. Configuração ausente usa o padrão indicado; valor inválido deve ser reportado na inicialização sem iniciar o serviço com regras ambíguas.

## 5. Modelo de dados (metadados do documento)

### Metadados públicos

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | UUID único do documento, usado nos endpoints de listagem e download. |
| `originalName` | string | Nome original fornecido no upload, apenas metadado e nome sugerido no download. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Data/hora UTC em ISO 8601, por exemplo `2026-11-04T12:00:00.000Z`. |
| `owner` | string | Valor de `DMS_DEFAULT_OWNER`; não representa autenticação ou controle de acesso. |

### Dados internos do repositório

O repositório em memória deve manter, além dos campos públicos, o nome físico gerado para o arquivo e o tipo de conteúdo determinado pela aplicação. Esses dados internos não devem ser serializados na API. O caminho absoluto deve ser resolvido a partir do diretório local configurado no código, nunca aceito do cliente nem retornado nas respostas.

Não há esquema de banco de dados. A estrutura em memória pode ser um mapa indexado por `id`. A escrita do arquivo deve terminar antes do registro dos metadados; se o registro falhar após a gravação, a aplicação deve tentar remover o arquivo recém-criado e registrar a falha para diagnóstico.

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
- **Validação:** arquivo obrigatório; extensão presente na allowlist; tamanho até `DMS_MAX_FILE_SIZE_BYTES`. Requisições com arquivo ausente ou campo não esperado são inválidas.
- **Sucesso:** `201 Created`, JSON com os metadados públicos do documento criado.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "relatorio.pdf",
  "size": 24576,
  "uploadedAt": "2026-11-04T12:00:00.000Z",
  "owner": "local-instance"
}
```

- **Erros:** `400 Bad Request` para arquivo ausente/campo inválido; `413 Payload Too Large` para limite excedido; `415 Unsupported Media Type` para extensão não permitida; `500 Internal Server Error` para falha inesperada de gravação. Para um erro de upload, o catálogo não pode conter um documento sem arquivo válido.
- **Códigos de erro sugeridos:** `FILE_REQUIRED`, `INVALID_FILE_FIELD`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `STORAGE_WRITE_FAILED`.

### GET /documents

- **Entrada:** sem parâmetros ou corpo.
- **Sucesso:** `200 OK`, JSON com a coleção ordenada por `uploadedAt` decrescente. Não há paginação no MVP.

```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "uploadedAt": "2026-11-04T12:00:00.000Z",
      "owner": "local-instance"
    }
  ]
}
```

- **Lista vazia:** `200 OK` com `{"documents": []}`.
- **Erro:** `500 Internal Server Error` se não for possível concluir a operação. O repositório em memória não deve falhar por consulta em condições normais.

### GET /documents/:id/download

- **Entrada:** `id` UUID na URL.
- **Sucesso:** `200 OK`, corpo binário transmitido como anexo, `Content-Disposition: attachment` com o nome original codificado com segurança e `Content-Type` determinado pela aplicação a partir do formato validado (usar `application/octet-stream` quando não houver mapeamento confiável). Enviar `Content-Length` quando conhecido.
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
- `repositories/`: manter metadados em memória e encapsular a localização/leitura do arquivo local. Não usar banco ou serviço externo.
- Dependências devem apontar para dentro conforme `routes -> controllers -> services -> repositories`; camadas internas não devem importar Express.
- Registrar as rotas no app Express existente e preservar `GET /health`.

### Frontend

- Manter React + Vite, componentes funcionais e organização em `components/`, `pages/` e `services/`.
- Centralizar chamadas `fetch` à API no serviço de frontend e usar o prefixo `/api`.
- A tela principal deve cobrir seleção/upload de um arquivo, lista com nome/tamanho/data, download, lista vazia e erros retornados pela API.
- Não implementar autenticação, gerenciamento de múltiplos usuários ou exclusão no MVP.

### Armazenamento e recuperação

- Multer com `diskStorage` grava arquivo físico localmente; nenhum provedor de upload ou armazenamento externo é permitido.
- O nome físico é gerado pela aplicação com UUID e extensão validada. O nome original não é usado para compor o caminho.
- Metadados vivem apenas na memória do processo. Reiniciar o processo deixa arquivos residuais sem referência no catálogo; a limpeza desses arquivos não é automática no MVP.
- Operações devem tratar falhas de disco explicitamente. O backend não deve anunciar sucesso antes da gravação completa do arquivo.

## 8. Plano de execução

As etapas abaixo descrevem trabalho futuro. A criação desta especificação não executa essas etapas nem altera arquivos de aplicação.

1. **Backend e testes:** implementar as camadas de rotas, controllers, services e repositories; configurar Multer `diskStorage` no diretório local; definir validações, erros e configuração por ambiente; cobrir upload, listagem, download, limites, tipos inválidos, identificadores inexistentes e falhas relevantes com testes.
2. **Frontend:** implementar a página e componentes de upload/listagem/download; criar serviço `fetch` sob `/api`; tratar carregamento, sucesso, lista vazia e erros; validar o fluxo no navegador.
3. **Integração e validação:** executar backend e frontend juntos, validar proxy e cabeçalhos de download, executar testes e builds disponíveis, revisar mensagens e comportamento responsivo, e confirmar que nenhum armazenamento externo foi introduzido.
4. **Operação e documentação:** registrar variáveis de ambiente, limites do armazenamento local, volatilidade dos metadados e procedimento de execução; confirmar que `/health` continua funcionando.
