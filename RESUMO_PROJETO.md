# Resumo do Projeto — BookList

## Visão geral

O **BookList** é uma aplicação web pessoal, local-first e em português (pt-BR), voltada a organizar conhecimento, trabalho técnico e vida pessoal em uma única interface. É uma SPA/PWA em JavaScript, HTML e CSS puros: não usa Node.js, npm, bundler ou framework de interface. O ponto de entrada é `index.html`.

O produto vai muito além de uma lista de links: reúne bookmarks, notas Markdown, base de conhecimento, CRM/ordens de serviço, finanças pessoais e técnicas, planejamento, redes, gamificação e visualizações.

## Arquitetura

```text
Navegador
  ├─ SPA Vanilla (`index.html` + `js/*.js`)
  ├─ Dados locais: IndexedDB (`booklist_local_first`) com fallback em localStorage
  ├─ Offline/PWA: `sw.js` + `manifest.webmanifest`
  ├─ Sincronização opcional: Supabase REST/Auth
  ├─ IA local: TF-IDF e Transformers.js carregado sob demanda por CDN
  ├─ Interface analítica: Chart.js carregado por CDN
  └─ Extensão de navegador: `browser-extension/` (Manifest V3)
```

O código é organizado como objetos globais, carregados em ordem por `index.html`. Os maiores módulos concentram a maior parte das regras de negócio: `app.js` (4.957 linhas), `features.js` (2.580), `storage.js` (2.120), `personal.js` (1.853) e `notes.js` (1.373).

## Funcionalidades principais

- **Conhecimento e organização:** bookmarks com categorias/pastas, notas Markdown, WikiLinks/transclusão, anexos e mídia offline, relações, coleções, busca fuzzy, consultas declarativas e mapas mentais.
- **Produtividade:** dashboard, comandos rápidos (`Ctrl+K`), tela dividida, quadro branco, kanban, calendário, automações, checklists, projetos, estudos e documentos.
- **Hub pessoal:** diário, áreas da vida, hábitos, metas, trackers, inbox e gestão financeira com gráficos e indicador “safe to spend”.
- **Hub técnico:** clientes, equipamentos, chamados/OS, conhecimento, runbooks, orçamentos, financeiro, agenda, scripts, toolbox e redes/topologia.
- **Visualização e IA:** grafo/“Cérebro Digital”, pesquisa semântica local, chat RAG sobre conteúdo local e integração opcional com OpenAI, Gemini ou Anthropic configurada pelo usuário.
- **Privacidade:** cofre para itens privados com PBKDF2 (180 mil iterações) e AES-GCM-256; desbloqueio mantido apenas em memória durante a sessão.
- **PWA/offline:** cache do shell da aplicação e estratégias network-first para HTML e cache-first para ativos estáticos.
- **Extensão Clipper:** salva bookmarks e recortes de páginas/seleções, com fila offline e integração ao mesmo armazenamento Supabase.
- **Infraestrutura:** um relay Python independente envia pacotes Wake-on-LAN a partir da topologia de rede.

## Persistência e sincronização

O `Storage` centraliza a persistência em um único object store chave-valor no IndexedDB. Os domínios sincronizáveis incluem bookmarks, notas, categorias/pastas, relações, coleções, workspaces, eventos, projetos, regras, estudos, documentos, áreas pessoais, módulos técnicos, canvas e configurações do cofre.

A sincronização Supabase é opcional e configurada na interface; utiliza autenticação, fila de alterações e metadados de atualização local/remota. A aplicação continua utilizável sem conta e sem rede.

## Estrutura relevante

| Caminho | Responsabilidade |
|---|---|
| `index.html` | Entrada, navegação lateral e ordem de carregamento dos módulos |
| `js/core.js` | Eventos, UI, busca fuzzy, Mermaid Lite, WikiLinks e QueryView |
| `js/storage.js` | IndexedDB, backup, cofre, sync e configurações |
| `js/app.js` | Roteamento SPA, dashboard e módulos técnicos |
| `js/features.js` | Power Hub e recursos transversais |
| `js/personal.js` | Domínios e indicadores pessoais/financeiros |
| `js/notes.js` / `js/bookmarks.js` | CRUD de notas e links |
| `js/modern-ui.js` + `css/modern-ui.css` | Camada visual premium e gráficos |
| `browser-extension/` | Clipper de navegador Manifest V3 |
| `gateway-wol-relay.py` | Relay HTTP local para Wake-on-LAN |
| `PROJECT_REFERENCE.md` | Especificação técnica e guia de transferência detalhado |
| `MODERN_UI_CHANGES.md` | Histórico/guia da camada visual |
| `NEW_FEATURES_IDEAS.md` | Backlog de produto |

## Estado observado

- A validação de sintaxe com `node --check` foi concluída sem erros para todos os arquivos JavaScript principais e da extensão.
- Esta cópia não contém `package.json`, ferramenta de build, configuração de testes, testes automatizados, CI nem metadados Git utilizáveis.
- A pasta `scratch/` concentra artefatos de investigação, recuperação e correções anteriores; não faz parte da execução normal da aplicação e aumenta o ruído do repositório.
- As dependências externas são diretas por CDN: Chart.js e, sob demanda, Transformers.js. Portanto, alguns gráficos e a IA por embeddings precisam de rede na primeira carga.
- O versionamento de cache merece atenção: o service worker usa `booklist-v69`, enquanto diversos recursos do HTML usam query string `v=57`. Alterações futuras devem atualizar ambos de forma coordenada.

## Pontos de atenção recomendados

1. Criar uma suíte mínima de testes para armazenamento, sincronização, cofre e rotas críticas — são os módulos de maior risco funcional.
2. Separar gradualmente os módulos monolíticos (`app.js`, `features.js`, `storage.js` e `personal.js`) para reduzir acoplamento via variáveis globais.
3. Adicionar `.gitignore`, iniciar/recuperar o Git e remover ou arquivar os artefatos de `scratch/` antes de publicar o código.
4. Revisar as integrações de IA e Supabase antes de produção, assegurando que chaves sejam inseridas apenas localmente e nunca versionadas.
5. Versionar de modo único os recursos e o service worker para evitar usuários com interface e lógica de versões diferentes.

## Conclusão

BookList é um **workspace pessoal local-first bastante abrangente**, com forte foco em autonomia de dados, operação offline e um público que combina gestão de conhecimento, vida pessoal e suporte técnico. A base funcional é rica e a documentação existente é extensa; a próxima evolução de engenharia deve priorizar testes, modularização e higiene do repositório.
