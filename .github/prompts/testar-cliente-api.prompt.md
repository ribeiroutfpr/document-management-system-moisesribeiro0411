---
description: "Cria ou atualiza testes do cliente fetch do frontend ao alterar contratos da API."
name: testar-cliente-api
argument-hint: "operação ou cenário (ex. upload rejeitado por tamanho)"
agent: agent
---

# Testar o cliente de API do frontend

Crie ou atualize testes para `${input:cenario:operação ou cenário da API}`.

Consulte as [instruções do projeto](../copilot-instructions.md), o
[cliente de API](../../frontend/src/services/api.js), os
[testes existentes](../../frontend/test/api.test.js) e os contratos na
[especificação](../../docs/specs/dms-spec.md) antes de alterar os testes.

Requisitos:

- Use `node:test` e `node:assert/strict`, sem adicionar dependências.
- Mantenha os testes em `frontend/test`, reutilizando os casos existentes sem duplicação.
- Simule `fetch` com `t.mock.method(globalThis, 'fetch', ...)`, sem rede ou serviços externos.
- Verifique o prefixo `/api`, o método HTTP e o corpo da requisição quando aplicável.
- No upload, confira o campo multipart `file` e a ausência de `Content-Type` manual.
- Cubra o sucesso e os erros relevantes ao cenário, incluindo mensagens do backend.
- Quando aplicável, verifique lista vazia, cancelamento e preservação do conteúdo binário.
- Não altere contratos nem código de produção para fazer testes passarem; reporte divergências.

Execute `cd frontend && npm test`. Ao concluir, informe os cenários cobertos e o
resultado real da execução, incluindo falhas ou impedimentos.
