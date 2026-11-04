# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey ribeiroutfpr!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/ribeiroutfpr/document-management-system-moisesribeiro0411/issues/1)

---

## Backend DMS

Execute `cd backend`, `npm install` e configure o mesmo segredo aleatório de pelo
menos 32 bytes no backend e no proxy confiável. Exemplo local:

```sh
export DMS_PROXY_SHARED_SECRET="$(openssl rand -hex 32)"
npm start
```

Para executar os testes, use `npm test` no diretório `backend`.

O backend segue o fluxo `routes -> controllers -> services -> repositories`:

- `POST /upload`: recebe um arquivo no campo `file` de `multipart/form-data`,
  valida extensão e assinatura e retorna metadados públicos com status `201`.
- `GET /documents`: retorna `{ "documents": [...] }` do usuário autenticado.
- `GET /documents/:id/download`: baixa como anexo somente documento do usuário.
- `GET /health`: retorna `{ "status": "ok" }`.

As três rotas de documentos só aceitam chamadas do proxy com `x-dms-proxy-secret`
válido e `x-authenticated-user`. O proxy de produção deve autenticar a pessoa,
remover cabeçalhos do cliente com esses nomes e inserir os valores confiáveis.
Não exponha o backend diretamente à rede pública. `/health` permanece público.

| Variável de ambiente | Padrão |
| --- | --- |
| `PORT` | `3000` |
| `DMS_MAX_FILE_SIZE_BYTES` | `10485760` (10 MiB) |
| `DMS_ALLOWED_EXTENSIONS` | `.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx` |
| `DMS_MAX_STORAGE_BYTES` | `1073741824` (1 GiB) |
| `DMS_MAX_DOCUMENTS` | `1000` |
| `DMS_MAX_UPLOADS_PER_HOUR` | `30` por usuário |
| `DMS_PROXY_SHARED_SECRET` | obrigatório para as rotas de documentos; mínimo 32 bytes |

Configurações numéricas inválidas e segredos fracos impedem a inicialização.
Extensões são comparadas sem diferenciar maiúsculas de minúsculas; o backend
também valida assinaturas básicas de formato. Não há análise antivírus.

Arquivos ficam exclusivamente em `backend/storage`, com nomes aleatórios.
O catálogo em `backend/storage/documents.json` é atualizado atomicamente e
restaurado após reinício. Faça backup do catálogo e dos arquivos físicos em
conjunto. O armazenamento e a cota são locais a uma única instância; arquivos
órfãos não são removidos automaticamente.

Erros usam `{ "error": { "code": "...", "message": "..." } }`, sem caminhos internos.
Consulte os contratos e status na [especificação](docs/specs/dms-spec.md).

## Frontend DMS

Com o backend em execução, configure no terminal do frontend o mesmo
`DMS_PROXY_SHARED_SECRET` e execute `cd frontend`, `npm install` e
`DMS_DEV_USER=seu-usuario npm run dev`. O usuário fixo é somente para
desenvolvimento local. Acesse `http://localhost:5173`.

A interface permite selecionar e enviar um arquivo, lista os metadados e oferece
um botão de download por documento. A lista é atualizada após cada upload e pode
ser recarregada pelo botão **Atualizar lista**. Carregamento, lista vazia e erros
são apresentados em português; as regras de extensão e tamanho são validadas pelo
backend, sem duplicação de configurações no frontend.

O cliente usa `fetch` com `/api` para upload multipart, listagem JSON e download
binário. O proxy do Vite remove esse prefixo no desenvolvimento. Em produção,
configure o servidor para encaminhar `/api` ao backend, também removendo o prefixo.

Execute `npm test` para testar o cliente de API e `npm run build` para gerar o
frontend de produção.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
