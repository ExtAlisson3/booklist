# Arquitetura do BookList

O BookList continua sendo uma PWA local-first sem etapa de compilação. Os arquivos históricos maiores permanecem ativos, mas novas responsabilidades devem entrar em `js/modules/` para reduzir o risco de manutenção.

## Limites atuais

- `js/app.js`: navegação, renderização das páginas legadas e catálogo de comandos. A interface da paleta está somente em `js/modules/command-palette.js`.
- `js/storage.js`: persistência local, criptografia e sincronização. Importação/exportação ficam em `js/modules/storage-portability.js`.
- `js/features.js`: módulos do Power Hub. Diagnóstico operacional fica isolado em `js/modules/system-health.js`.
- `js/personal.js`: fluxos pessoais. Provedores externos de mídia ficam em `js/modules/media-catalog.js`.
- `js/modules/dialogs.js`: serviço único de formulários curtos e confirmações, substituindo diálogos nativos do navegador.

## Regras para novas mudanças

1. Não adicionar uma segunda implementação de navegação, paleta, diálogo ou portabilidade.
2. Separar integrações externas da renderização da tela.
3. Manter lógica de transformação testável sem depender do DOM.
4. Executar `npm run check` antes de publicar.
5. Após alterar assets, executar `npm run pwa:bump`; a CI rejeita cache e query strings dessincronizados.

## Verificação

Os testes em `tests/` usam o executor nativo do Node e cobrem armazenamento, backup/importação, Cofre, fila de sincronização e registros técnicos. O workflow em `.github/workflows/ci.yml` executa sintaxe, consistência da PWA e testes.
