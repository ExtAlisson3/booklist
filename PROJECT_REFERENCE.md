# 📚 BookList - Especificação Técnica e Guia de Transferência do Projeto

Este documento serve como um guia abrangente e blueprint técnico detalhado do projeto **BookList**. Ele foi projetado para permitir a transferência rápida de propriedade, onboarding de novos desenvolvedores, migração ou reconstrução completa do banco de dados e sistemas integrados, sem necessidade de analisar o código-fonte original.

---

## 📅 Informações de Referência Rápida
- **Nome do Projeto:** BookList
- **Tipo de Aplicação:** Single Page Application (SPA), Progressive Web App (PWA), Local-First
- **Filosofia de Design:** Dependência zero (Zero Bundlers, Zero NPM Install), Portabilidade Absoluta (roda a partir de `index.html`), Design Premium (Glassmorphism, Neon Glows, Radial mouse tracking, Animações Micro-interativas).
- **Idioma do Projeto:** Código em Inglês; Interface e Documentação em Português (pt-BR).

---

## 🧬 1. Visão Geral e Filosofia Arquitetural

O **BookList** é um organizador pessoal e profissional avançado que combina gerenciamento de marcadores (bookmarks), notas em Markdown com transclusão no estilo Obsidian (WikiLinks), e um ecossistema integrado para profissionais técnicos (ERP-CRM modular para ordens de serviço, clientes, orçamentos, infraestrutura de redes e checklists).

### Princípios de Arquitetura:
1. **Local-First & Portabilidade:** Toda a lógica roda inteiramente no navegador do usuário. Os dados residem em bancos locais rápidos e robustos, persistindo mesmo sem conexão com a internet. O aplicativo pode ser executado simplesmente abrindo o arquivo `index.html` localmente.
2. **Dependência Zero (No-Bundling):** Não há pacotes do Node.js, `npm install`, Webpack, Vite ou Babel. Toda a modularização é feita via carregamento direto de scripts HTML5 e CSS Vanilla, acelerando a depuração e garantindo compatibilidade perpétua com navegadores modernos.
3. **Sincronização Descentralizada (Supabase):** Um motor de sincronização local-first gerencia uma fila local de alterações e realiza uploads/downloads incrementais e mesclagens inteligentes (merging bi-direcional livre de conflitos) com um backend na nuvem Supabase.
4. **Camada Visual Aditiva (Premium UX):** O visual premium (estilo Dark/Neon Cyberpunk com efeitos translúcidos e grafos vetoriais) é aplicado de forma aditiva por meio de um script (`js/modern-ui.js`) e folha de estilos (`css/modern-ui.css`) que envelopam a interface base sem modificar as regras de negócio originais. Se removidos, o app volta ao layout vanilla perfeitamente estável.

---

## 📁 2. Arquitetura de Pastas e Arquivos

Abaixo está o mapa completo da árvore de diretórios do BookList, detalhando a responsabilidade de cada componente:

```text
BOOKLIST/
├── index.html                    # Ponto de entrada SPA, sidebar com flyouts e scripts
├── manifest.webmanifest          # Manifesto PWA (Standalone, theme-color, icon.svg)
├── sw.js                         # PWA Service Worker (estratégias Cache-First e Network-First)
├── icon.svg                      # Ícone vetorial base da aplicação (Livros 📚)
├── PROJECT_REFERENCE.md          # Este guia técnico / blueprint do projeto
├── MODERN_UI_CHANGES.md          # Log de modificações e especificações do Modern UI
├── NEW_FEATURES_IDEAS.md         # Backlog de ideias de produto e UX
├── css/
│   ├── style.css                 # Layout base, sidebar, modo contexto (Trabalho/Pessoal/Tudo)
│   ├── extensions.css            # Blocos markdown, popovers e modais
│   ├── modern-ui.css             # Camada premium (aurora, glows, charts, flyouts)
│   └── command-palette.css       # Estilos da paleta de comandos (Ctrl+K)
├── js/
│   ├── core.js                   # Pub/Sub, sanitização, FuzzySearch, MermaidLite, WikiLinks, QueryView
│   ├── storage.js                # IndexedDB, Vault AES-GCM, sync Supabase, settings (workspaceMode)
│   ├── bookmarks.js              # CRUD de links, pastas, categorias, filtro por modo contexto
│   ├── notes.js                  # Editor Markdown, versões, filtro por modo contexto
│   ├── features.js               # Power Hub (Kanban, automações, estudos, inbox, cockpit, etc.)
│   ├── personal.js               # Hub pessoal (áreas, diário, hábitos, metas, tracker, money, inbox)
│   ├── app.js                    # Roteador SPA, CRM/OS técnico, modo contexto global, dashboard
│   ├── extensions.js             # Importadores, onboarding e utilitários complementares
│   ├── media.js                  # Mídias offline (blob no IndexedDB)
│   ├── ai.js                     # NLP local (TF-IDF + Transformers.js embeddings)
│   ├── graph.js                  # Cérebro Digital 3D (Canvas + física)
│   ├── modern-ui.js              # Enhancer visual (charts, ripple, MutationObserver)
│   ├── command-palette.js        # Paleta global de comandos e busca rápida (Ctrl+K)
│   ├── markmap-lite.js           # Mapas mentais a partir de listas Markdown
│   ├── whiteboard.js             # Quadro infinito (canvas de notas e setas)
│   ├── rag-chat.js               # Chat local “segundo cérebro” (RAG sobre notas/links)
│   ├── scanner.js                # Leitor QR/código de barras via câmera (Html5Qrcode)
│   ├── gamification.js           # XP, conquistas e recompensas de uso
│   └── network-topology.js       # Visualizador de topologia para módulo Redes
└── browser-extension/            # Clipper Companion (Chrome / Firefox)
    ├── manifest.json
    ├── popup.html / popup.js
    ├── background.js
    ├── README.md
    └── icons/icon.png
```

### 2.1. Navegação lateral (`index.html`)

A barra fixa (`#app-nav`) concentra atalhos principais e dois **flyouts** expansíveis ao passar o mouse:

| Grupo | Páginas (`App.navigate`) |
|---|---|
| **Principal** | `dashboard`, `bookmarks`, `notes`, `power`, Cérebro Digital (`App.showGraph`), Dividir tela |
| **Pessoal** (flyout) | `personal`, `life`, `journal`, `habits`, `goals`, `tracker`, `money`, `personal-inbox` |
| **Técnico** (flyout) | `tech`, `clients`, `equipment`, `tickets`, `knowledge`, `runbooks`, `budgets`, `finance`, `schedule`, `scripts`, `toolbox`, `networks` |
| **Rodapé** | Modo contexto (`#workspace-context-toggle`), `settings` |

### 2.2. Seis módulos JS adicionados recentemente

| Módulo | Responsabilidade |
|---|---|
| `command-palette.js` | Busca e comandos globais estilo Spotlight (`Ctrl+K`), integrado ao roteador |
| `whiteboard.js` | Canvas infinito para arrastar notas e ligar com setas |
| `markmap-lite.js` | Renderização de mapa mental a partir de bullets Markdown |
| `rag-chat.js` | Drawer de chat com contexto local (notas/bookmarks filtrados pelo modo) |
| `scanner.js` | Modal de câmera para QR/códigos (equipamentos, links rápidos) |
| `gamification.js` | Progressão, missões e XP persistidos em `booklist_gamification` |

Além desses seis, o projeto também carrega `network-topology.js` (topologia do módulo **Redes**) e `command-palette.css`.

---

## ⚙️ 3. Motores Internos e Fluxos de Dados

O ecossistema do BookList é mantido por vários motores internos construídos do zero em Vanilla Javascript:

### 3.1. O Motor de Busca Fuzzy (`FuzzySearch`)
Calcula a similaridade textual baseado em tokenização e distância de Levenshtein:
- **Normalização:** Remove acentuações (`NFD`), converte para minúsculas e remove caracteres especiais.
- **Tokenização:** Divide strings em palavras individuais.
- **Token Score:** Atribui pesos às palavras baseando-se em:
  - Correspondência exata: 100 pontos.
  - Prefixo: 82 pontos.
  - Inclusão interna: 68 pontos.
  - Distância de Levenshtein (para palavras $\ge 4$ letras): $58 - (\text{distância} \times 10)$.
- **Busca Global:** Procura em múltiplos campos (peso ajustável) e gera uma lista ordenada por relevância.

### 3.2. O Compilador de Fluxogramas (`MermaidLite`)
Interpreta blocos de código marcados com `mermaid` e gera fluxogramas SVG interativos:
- **Parser:** Analisa linhas de código estruturadas (ex: `A --> B`, `A --- B`, `A ==> B`).
- **Layout Engine:** Calcula os graus de entrada dos nós (indegree) usando fila topológica para distribuir os blocos em níveis (grid LR ou TD) com espaçamentos calculados (`180x58 px` por caixa, gap vertical `42 px`, gap horizontal `72 px`).
- **Renderizador SVG:** Cospe tags `<g>`, `<rect>`, `<text>` e `<line>` com marcadores de ponta de seta dinâmicos baseados no mapeamento vetorial obtido.

### 3.3. Transclusão e Relações Wiki (`WikiLinks`)
Processa e resolve links no formato Obsidian `[[Título]]` e embeds `![[Título]]`:
- **Resolução:** Varre notas locais e registros técnicos profissionais pelo título aproximado (fuzzy match).
- **Link (`[[Link]]`):** Substitui por elementos interativos com escuta a eventos. Abre o item correspondente ao ser clicado. Exibe um balão flutuante (`popover`) ao passar o mouse com uma prévia do conteúdo textual.
- **Embed (`![[Link]]`):** Substitui por um bloco completo (`wiki-transclusion`) exibindo o conteúdo formatado do item, executando novamente de forma recursiva o parser do MermaidLite, QueryView e outros WikiLinks internos.

### 3.4. Motor de Consultas Relacionais (`QueryView`)
Interpreta queries declarativas personalizadas escritas em blocos de texto (ex: `MOSTRAR tickets ONDE status = aberto`) e monta tabelas completas com ações de abertura rápida:
- **Sintaxe:** `MOSTRAR <alvo> [ONDE <campo> <operador> <valor>]`
- **Operadores Suportados:** `=` (contém/igual), `!=` (não contém), `~` / `contém` (fuzzy match), `>` (maior), `<` (menor).
- **Alvos:** Mapeia strings (notas, links, clientes, equipamentos, tickets, orcamentos, redes, money, tracker) para as chaves internas do banco IndexedDB e filtra os payloads JSON dinamicamente antes de gerar uma tabela HTML com botão de ação direta.

### 3.5. Cofre Criptográfico Residencial (`Secure Vault`)
Garante privacidade absoluta de marcadores e notas marcados como privados através da API nativa da Web Crypto:
- **Derivação de Chave:** Deriva uma chave simétrica forte de 256 bits através de **PBKDF2** (usando o salt gerado aleatoriamente e **180.000 iterações** de hash `SHA-256`).
- **Algoritmo de Criptografia:** Utiliza **AES-GCM de 256 bits** gerando um vetor de inicialização (`IV`) único para cada item.
- **Formato do Payload Protegido:** Salva no IndexedDB como string base64 unida no formato `iv_base64.cipher_base64`.
- **Sincronização em Nuvem (Portabilidade):** A chave de configuração (`booklist_vault` contendo o salt, o verifier e status) é totalmente sincronizada via Supabase (integrando a lista `SYNCABLE_KEYS`). Isso garante que ao alternar de navegador ou dispositivo, as credenciais e o salt original sejam automaticamente baixados, permitindo que a mesma senha descriptografe com sucesso os dados sincronizados em qualquer lugar.
- **Integração com Backups:** A configuração do cofre é incluída na exportação e importação manual (`exportAll` e `importAll`), viabilizando portabilidade offline completa.
- **PIN de 2FA com Hashing SHA-256:** O fator duplo local opcional de 6 dígitos é salvo e sincronizado na forma de hash hexadecimal SHA-256 (`totpSecretHash`), garantindo que o PIN em texto claro nunca seja exposto à nuvem, com fallback retroativo para texto puro em bases antigas.
- **Camada Protetora (`_decrypted`):** Ao desbloquear o cofre digitando a senha (e validando o PIN de 2FA, se ativo), os payloads são descriptografados e colocados sob a chave temporária `_decrypted` em memória RAM, sumindo por completo ao travar o cofre ou após o tempo de inatividade configurado.

### 3.6. Motor de IA Local-First (`WebAI`)
Fornece recursos de NLP inteiramente no navegador sem custos de API:
- **Heurística (TF-IDF):** Tokeniza, limpa stopwords e realiza buscas ou resumos estatísticos básicos de texto.
- **Transformers.js:** Baixa dinamicamente o modelo `Xenova/all-MiniLM-L6-v2` executando inferência via WebAssembly para gerar Embeddings Vetoriais.
- **Busca Semântica:** Compara embeddings no IndexedDB usando Similaridade de Cosseno para encontrar conteúdos relacionados independentemente das palavras exatas.

### 3.7. Cérebro Digital 3D (`GraphView`)
Visualiza as conexões do usuário num espaço tridimensional:
- **Simulação Física Customizada:** Aplica forças de gravidade para o centro, repulsão de Coulomb entre nós, e atração elástica (molas) nas conexões, tudo renderizado nativamente no Canvas 2D usando projeção perspectiva (focal length).
- **Conexões de IA:** Exibe links pontilhados entre nós que possuem alta similaridade semântica segundo o Motor de IA.

### 3.8. Modo Contexto Global (`workspaceMode`)
Filtro de foco em toda a interface, controlado pelo seletor na sidebar (`#workspace-context-toggle`):

| Modo | Efeito |
|---|---|
| **Tudo** (`all`) | Sem filtro; todos os módulos visíveis |
| **Trabalho** (`work`) | Bookmarks/notas com contexto trabalho/estudo; módulos técnicos liberados; hub pessoal exibe aviso |
| **Pessoal** (`personal`) | Bookmarks/notas pessoais; módulos da vida liberados; hub técnico exibe aviso |

A classificação de cada item usa, nesta ordem: tipo (`professional`, `personal`), `categoryIds` (`work`, `study`, `personal`), heurística de palavras-chave no título/conteúdo/tags. O valor persiste em `booklist_settings.workspaceMode` e em `document.body.dataset.workspaceMode`.

### 3.9. Cofre de Mídias Offline (`MediaManager`)
Gerencia o envio e exibição de imagens integradas de forma offline:
- **Compressão Dinâmica:** Intercepta drag/drop no editor de notas e comprime imagens via Canvas HTML5.
- **Armazenamento de Blob:** Salva o blob gerado no IndexedDB associado a um UUID (`media:uuid`).
- **Resolução de Renderização:** Transforma dinamicamente tags `![nome](media:uuid)` para Blob URLs reais antes da pintura no DOM.

---

## 💾 4. Estrutura e Esquemas de Dados

O banco de dados local roda no IndexedDB sob o nome `booklist_local_first` (versão 2) em um único ObjectStore chamado `kv`, cujo formato é `{ key: STRING, value: ANY, updatedAt: ISOSTRING }`.

Abaixo estão descritos todos os esquemas JSON de payloads salvos no banco local:

### 4.1. Marcadores (`booklist_bookmarks`)
```json
[
  {
    "id": "uuid-v4",
    "title": "Google DeepMind",
    "url": "https://deepmind.google",
    "description": "Pesquisas em inteligência artificial avançada.",
    "favorite": true,
    "categoryIds": ["dev", "news"],
    "workspaceId": "default",
    "inbox": false,
    "openCount": 12,
    "lastOpenedAt": "2026-05-19T19:10:00.000Z",
    "isPrivate": false,
    "lockedData": "",
    "publicShareId": "abc123xyz",
    "publicSharedAt": "2026-05-19T19:11:00.000Z",
    "createdAt": "2026-05-19T19:00:00.000Z",
    "updatedAt": "2026-05-19T19:10:00.000Z"
  }
]
```

### 4.2. Notas (`booklist_notes`)
```json
[
  {
    "id": "uuid-v4",
    "title": "Instalação do Supabase Local",
    "content": "<h1>Passos para subir o docker...</h1><pre><code>supabase start</code></pre>",
    "pinned": true,
    "categoryIds": ["work", "study"],
    "workspaceId": "default",
    "inbox": false,
    "isPrivate": false,
    "lockedData": "",
    "publicShareId": "7df8sa9",
    "publicSharedAt": "2026-05-19T19:12:00.000Z",
    "versions": [
      {
        "id": "uuid-v4-versao",
        "title": "Instalação do Supabase Local v1",
        "content": "<h1>Subir docker antigo...</h1>",
        "createdAt": "2026-05-19T18:00:00.000Z"
      }
    ],
    "_lastVersionAt": "2026-05-19T18:00:00.000Z",
    "createdAt": "2026-05-19T17:00:00.000Z",
    "updatedAt": "2026-05-19T19:12:00.000Z"
  }
]
```

### 4.3. Registros Profissionais Técnicos (`booklist_modules` -> `professionalRecords`)
O BookList separa os dados operacionais do CRM/OS técnico em um array centralizado para evitar misturar notas do dia a dia com ordens de serviço. Cada registro possui a seguinte estrutura de dados:
```json
[
  {
    "id": "uuid-v4",
    "moduleKey": "tickets", // clients, equipment, tickets, knowledge, runbooks, budgets, finance, schedule, scripts, toolbox, networks
    "title": "Manutenção Notebook Dell Inspiron",
    "content": "<h2>Diagnóstico inicial</h2><p>Máquina não liga, LED pisca laranja.</p>",
    "status": "diagnóstico",
    "clientId": "uuid-cliente",
    "equipmentId": "uuid-equipamento",
    "fields": {
      "reportedProblem": "Notebook não liga",
      "diagnosis": "Curto circuito na linha de 19V do carregador primário",
      "solution": "",
      "warrantyUntil": ""
    },
    "attachments": [],
    "createdAt": "2026-05-19T18:00:00.000Z",
    "updatedAt": "2026-05-19T18:30:00.000Z"
  }
]
```

#### 4.3.1. Campos Específicos por Mapeamento (`fields` do Registro Profissional):
- **`clients` (Clientes):**
  - `phone`: Telefone / WhatsApp.
  - `email`: E-mail de contato.
  - `address`: Endereço residencial/comercial.
  - `document`: CPF / CNPJ do cliente.
- **`equipment` (Equipamentos):**
  - `type`: Tipo de dispositivo (Notebook, Desktop, Servidor, Impressora).
  - `brandModel`: Marca e Modelo do aparelho.
  - `serial`: Número de série / Identificador físico.
  - `os`: Sistema Operacional.
  - `specs`: CPU, RAM, SSD/HDD.
- **`tickets` (Ordens de Serviço):**
  - `reportedProblem`: Problema informado pelo cliente na entrada.
  - `diagnosis`: Diagnóstico técnico.
  - `solution`: Ações efetuadas para resolução do defeito.
  - `warrantyUntil`: Data limite de garantia (formato YYYY-MM-DD).
- **`knowledge` (Artigos da Base Técnica):**
  - `problem`: Problema abordado.
  - `cause`: Causa provável.
  - `tags`: Palavras-chave para indexação.
- **`runbooks` (Procedimentos Operacionais Padrão):**
  - `objective`: Finalidade do runbook.
  - `frequency`: Periodicidade de execução.
  - `version`: Versão do manual.
- **`budgets` (Orçamentos):**
  - `validUntil`: Validade da proposta.
  - `payment`: Condição de pagamento acertada.
  - `warranty`: Prazo de garantia fornecido.
- **`finance` (Financeiro):**
  - `amount`: Valor monetário do lançamento (R$).
  - `movement`: Classificação ("Entrada" ou "Saída").
  - `dueDate`: Data de vencimento ou recebimento.
- **`schedule` (Agenda Técnica):**
  - `date`: Data e hora marcada.
  - `eventType`: Categoria (Visita Técnica, Entrega, Retorno, Reunião).
  - `location`: Endereço ou link da reunião.
- **`scripts` (PowerShell / Shell / CMD):**
  - `environment`: Ambiente aplicável (Windows Pro, Active Directory, Ubuntu Server).
  - `language`: PowerShell, Bash, CMD, Python.
  - `risk`: Potencial de risco/cuidados necessários na execução.
- **`toolbox` (Utilitários e Softwares):**
  - `url`: Link oficial para download limpo.
  - `category`: Diagnóstico, Backup, Remoção de vírus, Otimização.
  - `version`: Versão recomendada/estável.
- **`networks` (Infraestrutura de Redes - Detalhado):**
  - `gateway`: Endereço IP do gateway.
  - `dhcp`: Range ativa do servidor DHCP.
  - `wifi`: SSID padrão ou configurações básicas.
  - `version`: Versão física do rack/infra.
  - **`networkAdvanced`:** Objeto complementar de inventário massivo estruturado em sub-redes, Wi-Fi, CFTV e equipamentos (detalhado no fluxo do app):
    ```json
    {
      "devices": [{ "id": "1", "type": "roteador", "name": "Borda", "ip": "192.168.1.1", "mac": "00:aa:bb:...", "model": "MikroTik Hex GR3", "location": "Rack Térreo", "status": "atual", "notes": "" }],
      "subnets": [{ "name": "Lan Geral", "cidr": "192.168.1.0/24", "gateway": "192.168.1.1", "dhcp": "192.168.1.100-254", "dns": "1.1.1.1", "vlan": "10", "purpose": "Clientes" }],
      "wifi": [{ "ssid": "Empresa_GUEST", "security": "WPA2-PSK", "equipment": "Unifi U6 Lite", "location": "Recepção", "vaultRef": "Link do cofre", "notes": "" }],
      "cameras": [{ "name": "Cam Entrada", "ip": "192.168.1.30", "location": "Garagem", "channel": "3", "model": "Intelbras Dome", "notes": "" }],
      "audit": { "ipsDocumented": true, "configBackup": false, "firmwareChecked": true, "passwordsReviewed": true, "equipmentLabeled": true, "criticalPoints": true },
      "auditNotes": "Necessário subir backup do Switch Core no próximo sábado."
    }
    ```

### 4.4. Dados do Módulo Pessoal (`booklist_modules` -> `personalData`)
Agrupa coleções isoladas para gestão de vida:
```json
{
  "journal": [
    {
      "id": "uuid-v4",
      "title": "Corrida matinal",
      "date": "2026-05-19",
      "areaId": "uuid-area-saude",
      "mood": "🔥",
      "energy": 5,
      "content": "Hoje acordei cedo e corri 5km no parque.",
      "createdAt": "2026-05-19T10:00:00.000Z",
      "updatedAt": "2026-05-19T10:00:00.000Z"
    }
  ],
  "habits": [
    {
      "id": "uuid-v4",
      "name": "Beber 3L de água",
      "areaId": "uuid-area-saude",
      "frequency": "diário",
      "color": "#00BFA5",
      "note": "Importante para rins e foco"
    }
  ],
  "habitLogs": {
    "uuid-habito-agua": {
      "2026-05-19": true,
      "2026-05-18": true
    }
  },
  "goals": [
    {
      "id": "uuid-v4",
      "title": "Ler 12 livros no ano",
      "areaId": "uuid-area-pessoal",
      "status": "ativa",
      "horizon": "Dezembro 2026",
      "unit": "livros",
      "current": 4,
      "target": 12,
      "note": "Lista definida no Goodreads"
    }
  ],
  "inbox": [
    {
      "id": "uuid-v4",
      "title": "Comprar cabo HDMI de 5 metros",
      "areaId": "",
      "status": "pendente",
      "createdAt": "2026-05-19T16:00:00.000Z"
    }
  ],
  "money": [
    {
      "id": "uuid-v4",
      "title": "Assinatura Spotify",
      "amount": 21.90,
      "type": "saida", // entrada, saida
      "category": "Lazer",
      "date": "2026-05-19",
      "recurring": "mensal", // unica, mensal, anual, parcelada
      "areaId": "uuid-area-lazer",
      "notes": "Débito automático no cartão"
    }
  ],
  "tracker": [
    {
      "id": "uuid-v4",
      "title": "One Piece Manhwa / Mangá",
      "type": "manga",
      "status": "em lançamento",
      "currentChapter": 1115,
      "latestChapter": 1118,
      "areaId": "uuid-area-lazer",
      "rating": 9.5,
      "url": "https://leitura-onepiece.com",
      "rawUrl": "https://shonenjump.com/onepiece",
      "wikiUrl": "https://onepiece.fandom.com",
      "favorite": true,
      "note": "Arco de Egghead incrível."
    }
  ]
}
```

### 4.5. Gamificação (`booklist_gamification`)
```json
{
  "xp": 120,
  "level": 2,
  "achievements": ["first_note", "context_focus"],
  "rewards": ["theme_focus"],
  "stats": { "notesCreated": 4, "bookmarksSaved": 12 }
}
```

### 4.6. Configurações Globais (`booklist_settings`)
```json
{
  "theme": "dark", // dark, light
  "accent": "#7C4DFF",
  "language": "pt-BR",
  "onboardingDone": true,
  "pureMarkdownDefault": false,
  "workspaceMode": "all", // work | personal | all — filtra listas e páginas por contexto
  "aiNeuralSearch": false,
  "interfaceSounds": true,
  "sync": {
    "enabled": true,
    "supabaseUrl": "https://seusubabase.supabase.co",
    "anonKey": "sua-anon-key-publica-jwt",
    "email": "usuario@exemplo.com",
    "userId": "uuid-do-supabase-auth",
    "accessToken": "jwt-token-ativo",
    "refreshToken": "refresh-token-ativo",
    "expiresAt": 1779262000000,
    "lastSyncAt": "2026-05-19T19:12:00.000Z"
  }
}
```

---

## ☁️ 5. Especificação do Backend Supabase

Como uma aplicação Local-First, o backend atua como um storage de sincronização e replicação simplificado, utilizando duas tabelas fundamentais. O acesso é autenticado via políticas nativas de RLS (Row Level Security) e JWT.

### 5.1. DDL SQL para Criação das Tabelas e Políticas RLS

Para implantar o BookList em uma nova instância do Supabase, execute o código SQL a seguir no **SQL Editor** do painel do Supabase:

```sql
-- =========================================================================
-- 1. TABELA DE DOCUMENTOS SINCRONIZADOS (booklist_sync_documents)
-- Armazena os payloads locais encapsulados por chave (bookmarks, notes, etc.)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.booklist_sync_documents (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_key VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT booklist_sync_documents_doc_key_check CHECK (
        char_length(doc_key) BETWEEN 1 AND 255
        AND doc_key ~ '^[a-z0-9_:-]+$'
    ),
    CONSTRAINT booklist_sync_documents_pkey PRIMARY KEY (user_id, doc_key)
);

-- Ativar segurança de linhas (RLS)
ALTER TABLE public.booklist_sync_documents ENABLE ROW LEVEL SECURITY;

-- Exposição mínima pela Data API + políticas por operação.
REVOKE ALL PRIVILEGES ON TABLE public.booklist_sync_documents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booklist_sync_documents TO authenticated;

CREATE POLICY booklist_sync_documents_select_own ON public.booklist_sync_documents
FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY booklist_sync_documents_insert_own ON public.booklist_sync_documents
FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY booklist_sync_documents_update_own ON public.booklist_sync_documents
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY booklist_sync_documents_delete_own ON public.booklist_sync_documents
FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);


-- =========================================================================
-- 2. TABELA DE COMPARTILHAMENTO PÚBLICO (booklist_public_shares)
-- Armazena itens individuais que o usuário decidiu compartilhar via link
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.booklist_public_shares (
    share_id VARCHAR(16) NOT NULL CONSTRAINT booklist_public_shares_pkey PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind VARCHAR(50) NOT NULL, -- "note" ou "bookmark"
    title VARCHAR(255) DEFAULT 'Compartilhado',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ
);

-- Ativar segurança de linhas (RLS)
ALTER TABLE public.booklist_public_shares ENABLE ROW LEVEL SECURITY;

-- Compartilhamentos ativos são públicos; escrita continua restrita ao dono.
REVOKE ALL PRIVILEGES ON TABLE public.booklist_public_shares FROM anon, authenticated;
GRANT SELECT ON TABLE public.booklist_public_shares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booklist_public_shares TO authenticated;

CREATE POLICY booklist_public_shares_select_allowed ON public.booklist_public_shares
FOR SELECT TO anon, authenticated
USING (
    (enabled = true AND (expires_at IS NULL OR expires_at > now()))
    OR ((SELECT auth.uid()) = user_id)
);
CREATE POLICY booklist_public_shares_insert_own ON public.booklist_public_shares
FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY booklist_public_shares_update_own ON public.booklist_public_shares
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY booklist_public_shares_delete_own ON public.booklist_public_shares
FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);


-- =========================================================================
-- 3. INDEXAÇÃO DE DESEMPENHO E TRIGGERS DE ATUALIZAÇÃO
-- =========================================================================

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_sync_docs_user_id ON public.booklist_sync_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_public_shares_enabled ON public.booklist_public_shares(share_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_public_shares_user_id ON public.booklist_public_shares(user_id);

-- Trigger para automatizar o updated_at na tabela public_shares
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp
    BEFORE UPDATE ON public.booklist_public_shares
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
```

### 5.2. Algoritmo de Sincronização Local-First e Resolução de Conflitos
O sincronismo funciona de forma transacional e em lotes (`batches`):
1. **Marcação de Sujeira (`dirtyKeys`):** Qualquer gravação feita no IndexedDB que seja sincronizável é interceptada, adicionando a respectiva chave de armazenamento (ex: `booklist_notes`) ao array `dirtyKeys` e atualizando o `localUpdatedAt[key]` com o timestamp atual no metadado.
2. **PULL (Download):** O app puxa todos os registros remotos salvos na nuvem para o respectivo `user_id`.
   - Se o campo local **não** estiver marcado como sujo (`dirty`): substitui diretamente pelo payload do servidor.
   - Se o campo local **estiver** sujo e houver diferença de carimbos de tempo, o algoritmo de mesclagem (`_mergeSyncPayload`) entra em ação.
3. **Resolução de Conflitos e Mesclagem por ID (`_mergeById`):**
   - Para arrays de registros (marcadores, notas, transações, checklists, etc.), o sistema cria um mapa unindo os itens locais e remotos.
   - Itens que possuem o mesmo ID (`id`, `share_id` ou `name`) têm seus campos mesclados.
   - O objeto final sobrevivente é determinado pelo timestamp de edição mais recente (`updatedAt` $\ge$ `createdAt`).
   - O array combinado resultante é salvo localmente no IndexedDB e marcado na lista local como sujo para forçar a atualização de volta para a nuvem.
4. **PUSH (Upload):** Os blocos combinados e chaves locais que ainda constam como sujos são enviados ao Supabase em uma única transação HTTP `POST` com cabeçalho `Prefer: on_conflict=user_id,doc_key` executando um `upsert` atômico na nuvem.

---

## ⚡ 6. Manual de Configuração e Transferência

Este roteiro ensina passo a passo como configurar o ambiente e subir o projeto para produção ou ambiente local de desenvolvimento.

### 6.1. Instalação Local do Aplicativo Principal (PWA)
1. **Servidor Local Simples:** O PWA requer contexto seguro (`https://`) ou porta de loopback local (`http://localhost` ou `http://127.0.0.1`) para registrar o Service Worker.
2. **Execução rápida (Node.js integrado):**
   No terminal, dentro da pasta raiz do projeto, execute:
   ```bash
   npx serve -s .
   ```
   Ou usando Python:
   ```bash
   python -m http.server 8000
   ```
3. Abra `http://localhost:3000` (ou porta correspondente) no navegador.
4. **Instalação como PWA:** Um ícone de instalação (computador com uma seta) ficará visível na barra de endereços do Chrome/Edge. Clique nele para instalar o BookList diretamente na máquina como aplicativo nativo offline.

### 6.2. Configurando a Extensão Clipper do Navegador
A extensão funciona como um companheiro essencial para salvar sites e capturar textos com um clique.
1. Abra as configurações de extensões do navegador:
   - Google Chrome / Edge / Brave: Acesse `chrome://extensions/`
   - Mozilla Firefox: Acesse `about:debugging#/runtime/this-firefox`
2. **Modo Desenvolvedor:** Ative a chave de desenvolvedor (no canto superior direito no Chrome).
3. **Carregar Extensão:**
   - Chrome/Edge: Clique em **"Carregar sem compactação"** (Load unpacked) e selecione a pasta `browser-extension` do diretório do projeto.
   - Firefox: Clique em **"Carregar add-on temporário..."** e abra o arquivo `manifest.json` localizado na pasta `browser-extension`.
4. **Conexão:** Clique no ícone do BookList na barra de extensões, abra a aba **⚙️ Configurações**, digite a mesma URL e Anon Key do Supabase cadastrada no app web principal e faça login. Toda captura cairá na inbox de sync automaticamente.

### 6.3. Passos para Migração / Transferência de Propriedade
Caso o projeto precise ser migrado para outro programador ou conta:
1. **Backup dos Dados Existentes:** No app rodando no navegador do proprietário original, acesse **Configurações ⚙️** e clique em **Exportar Backup Completo (JSON)**. Isso baixará uma imagem idêntica contendo tudo o que está salvo no IndexedDB.
2. **Subir Novo Servidor Supabase:** Crie um novo projeto no Supabase, abra o editor SQL e rode o script DDL fornecido na Seção 5.
3. **Troca de Credenciais:** No app web, vá até as Configurações de sincronização, desvincule a conta antiga e cadastre as novas credenciais de URL, Anon Key e dados de login do novo Supabase.
4. **Importação:** Clique em **Importar Backup** e selecione o arquivo JSON obtido no passo 1. O sistema executará o sincronismo completo inicial para povoar o novo servidor instantaneamente.

---

## 📈 7. Auditoria da Interface Aditiva Premium (`Modern UI`)

A interface aditiva redesenha por completo a experiência de navegação do BookList, provendo visual imersivo através de técnicas CSS avançadas que complementam o código base de forma encapsulada:

- **Efeito Aurora e Iluminação de Fundo:** O corpo do aplicativo ganha um fundo imersivo contendo blobs radiais desfocados e animados (`muiAurora1` e `muiAurora2`) que rotacionam e se alternam suavemente a cada 25 segundos, mudando de cor conforme o tom de destaque (`--accent`) configurado.
- **Rastreamento de Mouse (Radial Glow):** As caixas e painéis do Dashboard, CRM Técnico e Áreas da Vida contam com escutas em JavaScript que capturam as coordenadas $x$ e $y$ do ponteiro do mouse, atualizando variáveis CSS locais (`--mx` e `--my`) para projetar um brilho radial sutil em tempo real atrás do cursor.
- **Transições e Efeitos Glassmorphic:** Menus suspensos, modais e rodapés ganham `backdrop-filter: blur(16px)` com gradientes semitransparentes combinados em múltiplas camadas de sombras para simular placas de acrílico iluminadas por fitas neon.
- **Barra de Navegação Dinâmica:** O menu lateral ganha um indicador vertical flutuante de 3 px que se posiciona de forma elástica no item ativo. Os botões de atalho exibem dicas visuais customizadas (tooltips) e halo pulsante.
- **Dashboard Estatístico com Sparklines:** Utilizando a biblioteca leve **Chart.js** acoplada dinamicamente via CDN deferido, cada card numérico do dashboard recebe um micro-gráfico de linha (sparkline) revelando o ritmo de atividades acumuladas sem grades, eixos ou distrações visuais.
- **Painéis Deslizantes com Ajuste Dinâmico:** A listagem de pastas de links e o editor de notas possuem barras divisórias redimensionáveis (`panel-resizer`) acionadas via `pointerdown`. O usuário arrasta para ajustar as colunas conforme preferência, salvando a largura exata em pixels diretamente no `localStorage` sob as chaves `booklist_bk_folders_width` e `booklist_notes_list_width` para as sessões futuras.

---

---

## 💎 8. Especificações Técnicas dos Novos Motores (v69)

### 8.1. Motor Físico da Árvore RPG (`Gamification.SKILL_NODES`)
A Árvore de Habilidades RPG foi desenvolvida como um motor de física de partículas 2D/3D integrado no Canvas. A física vetorial calcula as seguintes forças em cada quadro do `requestAnimationFrame`:
1.  **Força de Restauração Elástica (Lei de Hooke):** Puxa a partícula de volta à sua coordenada ideal relativa ao centro dinâmico do Canvas (que acompanha o deslocamento da câmera quântica arrastável):
    $$\vec{F}_a = -k \cdot (\vec{x} - \vec{x}_{ideal})$$
    Onde $k = 0.04$ é a constante de mola que suaviza o retorno dos nós.
2.  **Repulsão Eletrostática (Lei de Coulomb modificada):** Evita sobreposições aplicando uma força repulsiva inversamente proporcional à distância se as partículas estiverem dentro de um raio de colisão de $80\text{ px}$:
    $$\vec{F}_r = \frac{q}{d} \cdot \hat{d}$$
    Onde $q = (80 - d) \times 0.08$ garante que a força cresça quanto mais próximos os nós estiverem.
3.  **Bônus Cumulativos em Memória:** Os multiplicadores são injetados diretamente na função `awardXp(amount, reason)`. O ganho de XP global ou específico (Bookmarks, Tickets e Lançamentos Pessoais) é escalado baseando-se no vetor de nós desbloqueados (`unlockedNodes`), persistido localmente e na nuvem.

### 8.2. Algoritmo Preditivo "Safe to Spend"
A visão de Inteligência Financeira baseia-se em uma análise temporal do fluxo de caixa pessoal. O valor líquido seguro é computado da seguinte forma:
1.  **Salário Estimado:** Se o total de entradas no mês atual for nulo, o sistema retrocede $30\text{ dias}$ no banco local e recupera a soma de receitas do mês anterior como uma estimativa de fluxo contínuo.
2.  **Análise de Despesas Recorrentes Pendentes:** Varre as saídas registradas nos últimos 6 meses com o sinalizador `recurring: true`. Agrupa-as por título normalizado (removendo diacríticos, acentos e convertendo para minúsculas).
3.  **Detecção de Pagamento no Mês Vigente:** O motor cruza a lista acumulada de recorrências contra as saídas reais do mês atual. Se o título normalizado de uma recorrência histórica não constar no conjunto de saídas do mês, ela é classificada como **Obrigação Recorrente Pendente (Compromisso Futuro)**, e seu valor estimado é retido.
4.  **Cálculo Final:**
    $$\text{Safe to Spend} = \text{Receitas (Reais/Estimadas)} - \text{Saídas Efetuadas} - \sum \text{Compromissos Recorrentes Pendentes}$$
    A interface reage dinamicamente, alternando o brilho e a cor da borda neon (HSL) com base no percentual restante do orçamento.

### 8.3. Motor Quântico de Viagem Temporal (`window.TimeTravelDate`)
O motor transforma a base IndexedDB local em um banco temporal retroativo sem a necessidade de reescrever as visualizações dos componentes individuais:
1.  **Filtro no Nível do Storage:** Os getters globais em `js/storage.js` (`getBookmarks`, `getNotes`, `getPersonalData`, `getProfessionalRecords`) interceptam o retorno dos dados. Se `window.TimeTravelDate` for um objeto Date ativo, o array original é submetido a um filtro instantâneo:
    $$\text{Retorno} = \{ \text{Item} \in \text{Tabela} \mid \text{Data de Criação (ou Lançamento)} \le \text{TimeTravelDate} \}$$
2.  **Reconstrução de Logs complexos:** Para logs de hábitos e registros cumulativos, o motor reconstrói o estado lógico da data escolhida, removendo check-ins e evoluções subsequentes de forma que todos os heatmaps, gráficos de barras e porcentagens se comportem exatamente como na data destino.
3.  **Controle de Drag Debounced:** A interface utiliza escutas `oninput` no controle range slider para filtrar o cache em tempo real em memória e computar o Holograma Estatístico de comparação instantaneamente, enquanto o evento `onchange` executa o commit da viagem temporal com `App.renderPage()`, evitando gargalos de escrita e mantendo a taxa de quadros em $60\text{ fps}$.

---

Este documento consolida a maturidade do BookList, provendo clareza absoluta sobre os fluxos locais e distribuídos de dados. Em caso de dúvidas, consulte os respectivos arquivos fonte descritos na Seção 2.
