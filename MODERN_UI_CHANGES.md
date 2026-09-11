# Modern UI / UX Overhaul — BookList

> Repaginação visual completa do BookList em modo **aditivo**: nenhum arquivo
> original do app foi reescrito. Toda a nova camada vive em apenas três
> arquivos novos + 3 linhas alteradas no `index.html` e no `sw.js`.
>
> Esta arquitetura permite reverter tudo deletando os arquivos novos e
> removendo as 3 linhas, sem efeito colateral.

---

## 1. Arquitetura plug-and-play

### Arquivos novos
| Arquivo | Função |
|---|---|
| `css/modern-ui.css` | Overlay visual completo, carregado **após** `style.css` e `extensions.css`. Apenas refina classes existentes ou cria novas com prefixo `mui-`. |
| `js/modern-ui.js` | Enhancer encapsulado em IIFE. Adiciona Chart.js, ripple, contadores animados, gráficos por página, navegação por teclado, FAB. **Tudo em `try/catch`** — falha silenciosa nunca quebra o app. |
| `MODERN_UI_CHANGES.md` | Este documento. |

### Arquivos editados (mínimo)
| Arquivo | Linhas alteradas | O que mudou |
|---|---|---|
| `index.html` | 3 inseridas | `<link>` para o CSS, `<script>` para Chart.js (CDN) e `<script>` para `modern-ui.js`. |
| `sw.js` | 3 atualizadas | `CACHE_NAME` bumped + 2 novos arquivos no `APP_SHELL`. |

### Como o overlay funciona
- O CSS usa `:where(...)`, `color-mix`, `backdrop-filter`, gradientes e variáveis
  CSS já definidas no `:root` original (`--accent`, `--accent2`, `--accent3`,
  `--bg-card`, etc.), portanto respeita tema claro e accent customizado.
- O JS observa `#main-content` via `MutationObserver` (com `subtree: false`,
  debounce de 80 ms). Toda vez que `App.renderPage()` substitui `innerHTML`,
  o enhancer dispõe dos charts antigos e re-injeta os relevantes para a página
  atual lendo `App.currentPage`.
- Chart.js é carregado por CDN com `defer`. Se o CDN falhar (offline), o
  enhancer detecta `typeof window.Chart === "undefined"` e re-tenta com
  setTimeout; após algumas tentativas desiste sem afetar o resto.

### Dependências externas adicionadas
| Lib | Como | Tamanho gz |
|---|---|---|
| **Chart.js 4.4.1** | `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer>` | ~70 kB |

Nenhuma outra dependência. Sem build step, sem `npm install`, sem bundler.

---

## 2. O que foi feito por página

### Aurora global
- Fundo do `.app-main` ganhou dois blobs radiais animados (`muiAurora1` e
  `muiAurora2`, 22 s + 28 s, alternados) que se movem suavemente atrás do
  conteúdo. Desligados em `prefers-reduced-motion`.

### Dashboard (`/dashboard`)
- **Welcome**: `welcome-kicker` virou pill glass; `h1` com `gradient-text`
  agora tem `background-size: 220%` + animação `muiShine` 8 s.
- **Stats grid**: cada `.stat-card` ganhou:
  - Brilho radial seguindo o cursor (variáveis `--mx`/`--my` definidas via JS).
  - Sparkline (Chart.js mini-line) renderizada via `addSparklines()`.
  - Ícone em pill com glow no `--card-accent`.
  - Número animado de 0 ao valor real com easing cúbico (900 ms).
- **Charts grid (`.mui-charts-grid`)** — injetada via JS após `stats-grid`:
  - **Atividade dos últimos 14 dias**: linha dupla (bookmarks + notas) com
    gradiente, tooltip arredondado, sem points (aparece no hover).
  - **Distribuição do conteúdo**: donut com total no centro (plugin custom
    `centerText`), legenda HTML com bullets coloridos.
- **Quick actions**: gradient overlay no hover.

### Bookmarks (`/bookmarks`)
- **Card**: borda gradiente seguindo `--cat-color` no hover (técnica
  `mask-composite: exclude`), favicon roda −6° no hover, estrela com glow
  para `.is-favorite`, sombra colorida no hover.
- **Sidebar de pastas**: hover translada à direita 4 px, ativo tem barra
  lateral com gradient + badge accent.
- **Category filter**: chips com lift + shadow colorido no hover usando
  `color-mix` com `--cat-color`.

### Notes (`/notes`)
- **Note card**: hover desliza 2 px; `.active` tem gradiente lilás + sombra
  interna; `.is-pinned` usa `border-image` gradiente (substitui o sólido).
- **Editor empty state**: ícone maior, animação `muiFloat`.

### Power Hub (`/power`)
- **Header**: virou hero com aurora (gradiente accent + accent2), borda
  glass e backdrop blur.
- **Nav shell**: container glass com sombra suave.
- **Group tabs**: viraram **segmented control** (4 px padding interno, 10 px
  radius nos botões, ativo é gradient pill com sombra accent).
- **Sub-tabs**: agora roláveis horizontalmente com scrollbar de 4 px;
  `scrollActiveFeatureTab()` no JS centraliza o tab ativo automaticamente.
- **Feature card**: borda gradiente no hover via `mask-composite: exclude`.

### Cofre Privado (`/power > secure > vault`)
- **Indicadores de Cadeado Neon:** Animação e brilho neon em SVG que reflete o estado do cofre (cadeado trancado pulsando vermelho/laranja em segurança máxima ou cadeado aberto brilhando verde neon).
- **Show Password Toggle (Olho):** Botão inline no input de senha que revela o texto digitado ao clicar, prevenindo erros de digitação catastróficos.
- **Painéis Glassmorphic Customizados:** Divisão harmônica em seções translúcidas para "Trancar/Desbloquear", "Enviar ao cofre", "PIN de 2FA local" e "Tempo de Auto-bloqueio".
- **Auto-bloqueio Integrado:** Configuração do temporizador trazida diretamente para dentro do painel do cofre para agilizar o acesso.
- **Galeria Visual de Itens Criptografados:** Grid moderno de cards de notas e marcadores privados. Exibe um visual trancado com efeito de brilho avermelhado sutil e descrição cifrada, revelando títulos, tipos e ações de abertura ("Abrir"/"Visitar Link") ou reversão ("Tornar Público") instantaneamente após o desbloqueio.

### Personal Hub
- **Home (`/personal`)**: gráfico de **consistência dos hábitos (14 dias)**
  em barras com gradiente accent → accent2.
- **Áreas da Vida (`/life`)**: `.area-card` ganha glow radial usando
  `--area-color`.
- **Diário (`/journal`)**: `personal-record` com lift + sombra colorida no
  hover.
- **Hábitos (`/habits`)**: dois charts:
  - **Check-ins por dia da semana (últimas 4 semanas)** — barras verticais.
  - **Streak atual por hábito (top 8)** — barras horizontais coloridas
    por `habit.color`.
- **Metas (`/goals`)**:
  - **Metas por status** (donut).
  - **Top 6 — progresso** (barras horizontais).
  - `goal-progress` ganhou shimmer (faixa branca deslizando 2.6 s).
- **Tracker (`/tracker`)**:
  - **Obras por tipo** (donut).
  - **Obras por status** (donut).
  - `tracker-progress` ganhou shimmer + glow accent.
- **Money (`/money`)**:
  - Mantidos os charts custom originais (resumo, 6 meses, fluxo do mês,
    categorias).
  - Adicionado **Evolução do saldo (90 dias)** — line cumulativo com
    gradient fill, tooltip arredondado.

### Técnico OS (`/tech` e módulos)
- Hero ganhou gradient + aurora.
- Module cards têm seta animada (`→` que desliza no hover).
- **Charts injetados na home técnica**:
  - **Registros por módulo** (donut).
  - **Atendimentos por status** (barras).

### Settings (`/settings`)
- Título com gradient.
- Cards com lift + barra lateral gradient (vermelha em `.danger`).
- **`sync-status`**: agora tem ponto pulsante colorido conforme estado
  (`sync-synced` = verde fixo com glow; `sync-syncing/pending` = azul com
  blink; `sync-error` = vermelho com blink rápido).
- **`mgmt-item`**: hover translada à direita 2 px, glow no `.color-dot`.

### Sidebar / Nav (`.app-nav`)
- Fundo recebeu gradiente vertical com tinta accent no topo + radial sutil.
- Logo com pulse contínuo (`muiLogoPulse` 6 s) + halo radial animado.
- **Indicador ativo**: barrinha vertical de 3 px que aparece à esquerda do
  item ativo, com glow accent (expande para `-10px` quando sidebar abre).
- Grupo com item ativo ganha bolinha accent piscante (`muiBlink` 2 s) no
  modo colapsado.
- Divisores ficaram com gradient horizontal (transparente → glass →
  transparente) e crescem em largura quando a sidebar abre.
- Flyout com blur 16px + borda accent suave + sombra colorida.

### Modais
- **Backdrop**: blur 8 px + saturate 140%, fundo `rgba(5,8,18,.55)`.
- **`.modal-v2`**: gradient radial accent no topo, sombra colorida
  combinando 3 camadas (sombra escura, ring accent, inset highlight).
- **Header**:
  - `modal-title-icon` com gradient + animação `muiSpin` (cone girando 4 s)
    + inset glow.
  - Título com gradient text.
- **`modal-close`**: gira 90° no hover, borda vermelha + sombra danger.
- **Inputs no modal-v2**: focus com triple shadow (glow + sombra accent +
  fundo levemente mais claro).
- **Professional fields**: gradient sutil no fundo + barra accent antes
  do `h4`.
- **Form actions**: separador superior glass.
- **Entrada**: scale + slide; barra superior animada 3 cores
  (accent → accent2 → accent3) com `muiShine` 6 s.

### Confirm Dialog
- Aparece com `muiPop` 350 ms + glow accent.

### Toasts
- 14 px radius, 260 px min-width.
- **Barra de progresso** na base (`muiToastBar` 3.4 s scaleX 1 → 0).
- Sombras coloridas conforme tipo (success/info/error).
- Glass com blur 8 px.

### Command Palette
- Input com radius 14, padding 16, gradient sutil + focus ring accent.
- Resultados com radius 10, sem border-bottom (substituído por margin).
- Hover desliza 2 px + gradient accent.
- **Hint** virou pill uppercase com accent.
- **Navegação por teclado**: ↑/↓ navegam, Enter executa o item focado.
  Implementado em `installCommandPaletteKeys()`.

### Kanban
- Coluna com fitilho gradient no topo, badge `●` antes do título.
- Cards com lift + glow accent no hover.
- Cursor `grab`/`grabbing` explícito.

### Calendar
- Day cells com hover translateY + sombra.
- `today` ganha ring 2 px accent + glow 24 px.
- Botões de evento com radius e hover background accent.

### Timeline
- Linha vertical de 2 px com gradient accent → accent2 → transparent
  + box-shadow accent-glow.
- Markers `::before` com gradient + halo.
- `timeline-row-button` desliza 4 px no hover.

### Canvas (Power Hub → Canvas)
- Background grid com tinta accent (6%) + radial glow accent superior.
- `canvas-node` com blur, hover lift + ring accent.

### Empty states
- Ícone com `muiFloat` 4 s + drop-shadow accent.

### Progress bars universais
- `.tracker-progress span` e `.goal-progress span` agora têm:
  - Background gradient accent → accent2.
  - Glow box-shadow accent.
  - **Shimmer**: faixa branca pseudo-elemento `::after` deslizando 2.4 s.
  - JS `animateProgressBars()` reinicia `width` para 0 e anima até o
    valor real em qualquer página.

### Heatmap
- `.heat-cell` hover faz scale 1.6 + ring `var(--accent-glow)`.
- Em `.habit-heatmap` o efeito é mais suave (scale 1.5).

### Botões
- `.btn-primary` agora é gradient animado (accent → #9B6BFF → accent2) com
  `background-size: 200%` e desliza no hover.
- `.btn-secondary` com blur + lift + glow.
- `.btn-danger` com glow vermelho.
- **Ripple effect** em `.btn`, `.quick-action-btn`, `.module-card`,
  `.stat-card`, `.cockpit-card` (via `installRipple()`).

### Inputs em toda parte
- Focus com triple shadow (accent-glow + sombra colorida).
- Hover discreto trocando border para `--border-hover`.

### Scrollbar
- Gradient accent → accent2, 8 px largura.

### FAB "voltar ao topo"
- Botão circular fixo no canto inferior direito, aparece quando o scroll
  passa de 240 px. Detecta automaticamente qual contêiner está rolando
  (`dashboard`, `module-page`, `feature-page`, `settings-page`, ou
  `window`).

### Tooltip
- Selector `[data-tip]` mostra tooltip glass no hover. Pode ser usado
  por qualquer elemento futuramente.

### Print
- `@media print` esconde nav, FAB, toasts e overlays.

---

## 3. Bibliotecas adicionadas

| Lib | Versão | URL | Uso |
|---|---|---|---|
| Chart.js | 4.4.1 | CDN jsdelivr | Todos os gráficos. UMD build. |

> Tudo o resto (animações, ripple, glassmorphism, tilt, sparkline) é
> CSS puro + JS vanilla. Zero framework.

---

## 4. Performance e fallbacks

- **Animações desligadas** com `prefers-reduced-motion: reduce`.
- **Print**: nav, toasts e overlays escondidos.
- **Chart.js offline**: enhancer detecta ausência e segue sem charts.
- **Browser sem `color-mix`**: degrada para a cor base do gradient (não
  quebra layout).
- **MutationObserver `subtree: false`**: observa só os filhos diretos de
  `#main-content`, evita re-renders desnecessários.
- **Dispose de charts**: cada `applyEnhancements()` destrói as instâncias
  Chart.js antigas antes de criar novas (evita memory leak).
- **Tudo encapsulado em `try/catch`**: nenhum erro do enhancer pode
  quebrar o app principal.

---

## 5. Convenções de classe

| Prefixo | Significado |
|---|---|
| `mui-` | Componente novo criado pelo overlay (ex.: `.mui-chart-card`, `.mui-page-charts`, `.mui-fab`, `.mui-spark`, `.mui-skeleton`, `.mui-focused`). Pode ser removido sem afetar app. |
| `muiX` (camelCase no `@keyframes`) | Keyframes da overlay (ex.: `muiShine`, `muiPop`, `muiFloat`, `muiToastBar`, `muiAurora1/2`, `muiBlink`, `muiSpin`, `muiSkel`, `muiShimmer`, `muiLogoPulse`, `muiPulseGlow`). |

> Nunca renomei classes existentes. Sempre adicionei `mui-` ou estendi
> seletor existente (ex.: `.note-card.active`, `.stat-card:hover`).

---

## 6. Versionamento e cache

- Querystring `?v=N` em todos os assets para invalidar cache do navegador.
- `sw.js` bump em `CACHE_NAME` (atual: `booklist-v50`). Cada bump dispara
  o `activate` event do service worker, que limpa caches antigos e busca
  os arquivos novos.
- **Para forçar atualização durante dev**: Ctrl+F5 uma vez. O SW vai
  detectar a nova versão e o `updatefound` handler no `index.html`
  recarrega a página automaticamente.

| Versão | O que mudou |
|---|---|
| `modern-ui.css?v=1` + `modern-ui.js?v=1` | Lançamento inicial: aurora, dashboard charts, stat polish, ripple. |
| `modern-ui.css?v=2` + `modern-ui.js?v=2` | Part 2: bookmarks/notes/modais/forms/personal/charts por página. |
| `modern-ui.css?v=3` + `modern-ui.js?v=3` | Part 3: sidebar, settings, power hub nav, kanban, calendar, timeline, command palette, FAB, tooltip. |

---

## 7. Roadmap — instruções para sessões futuras

### 🎯 Próximas melhorias visuais sugeridas (alto valor, baixo risco)

1. **Tema claro completo**
   - Hoje a overlay funciona em ambos, mas alguns gradientes estão
     calibrados para dark. Revisar `.modal-v2` background, gradient text,
     e tons de glass para o `body.theme-light`.
   - Arquivo: `css/modern-ui.css`, blocos `body.theme-light` (já existe um;
     duplicar onde necessário).

2. **Mais accents customizáveis**
   - O usuário pode trocar `--accent` em settings, mas `--accent2` e
     `--accent3` ficam fixos. Adicionar pickers para os dois e fallback
     em `applyAppearance()` no `app.js`.

3. **Animação de transição entre páginas**
   - Hoje a entrada usa `muiFadeUp` em filhos. Adicionar um overlay de
     transição (cortina gradient deslizando) entre `navigate()` chamadas.
   - Implementação: adicionar `transitionend`/`requestAnimationFrame` no
     `App.navigate` ou interceptar via MutationObserver no overlay.

4. **Charts adicionais**
   - **Projetos**: Gantt simples com `Chart.js` (bar horizontal com base
     em datas).
   - **Estudo**: Curva de retenção via flashcards.
   - **Saude do app (Power Hub)**: Linha de uso ao longo do tempo.
   - **Inbox**: Funil "captura → revisar → arquivado/processado".

5. **Drag overlay visual**
   - No kanban e nos bookmarks/notes (que têm drag-and-drop), adicionar
     overlay translúcido + glow no card sendo arrastado e ring na zona
     de drop. Atualmente o feedback é nativo do browser.

6. **Skeleton loading**
   - A classe `.mui-skeleton` já existe. Usar quando `Storage.fetchPublicShare`
     está carregando, ou na primeira renderização de dashboard com muitos
     dados (renderiza skeletons primeiro, troca pelo conteúdo real).

### 🚀 Funcionalidades novas (médio esforço)

7. **Painel de comando expandido (Cmd Bar 2.0)**
   - Reaproveitar `.command-palette` e adicionar:
     - Filtros por seção (`@pessoal`, `@tech`, `@bookmark`).
     - Comandos com argumentos (ex.: `novo bookmark <URL>`).
     - Histórico dos últimos 5 comandos.
   - Já tem navegação por teclado pronta.

8. **Atalhos contextuais no FAB**
   - Botão FAB hoje só "volta ao topo". Transformar em FAB com fan-out
     (3-4 ações: novo bookmark, nova nota, captura, comando).

9. **Modo foco / leitura**
   - Já existe tab "Foco" e "Leitura" no Power Hub. Conectar a um
     overlay que esconde nav, sidebar, toolbars e maximiza o conteúdo
     atual. CSS classe `body.is-focus-mode { ... }` esconde os elementos
     via `display: none`.

10. **Toasts com ações inline (já parcial)**
    - O app já passa `{ label, onClick }` para o toast (visto em
      `Bookmarks.delete`). Estilizar o `.toast-action` button para
      destacar bem.

11. **Tooltip helper universal**
    - `[data-tip]` já existe. Marcar elementos no JS principal
      (botões de ícone, breadcrumbs, etc.) com `data-tip` para ganharem
      tooltips bonitos sem precisar do `title=` nativo.

### 🧪 Experimentação visual (alto impacto, alto risco)

12. **3D tilt nos cards principais**
    - Adicionar `transform: perspective(800px) rotateX/Y` ao
      `installCardShine()` para inclinar levemente os `.stat-card` /
      `.cockpit-card` seguindo o cursor.

13. **Lottie/Rive animations para empty states**
    - Substituir os ícones flutuantes por animações vetoriais leves.
      Add `<script src="https://unpkg.com/@lottiefiles/lottie-player">`.

14. **Spline 3D background opcional**
    - Para usuários "premium" ou um modo "showcase", embed um cubo
      WebGL leve atrás da aurora. Pode degradar mal em mobile —
      precisa feature-detection.

15. **View transitions API**
    - Quando trocar de página, usar `document.startViewTransition()`
      (Chrome/Edge) para crossfade nativo. Fallback é o `muiFadeUp`
      atual.

### 🛠 Refatoração / dívida técnica

16. **Migrar `extensions.css` para o mesmo modelo de overlay**
    - Hoje `extensions.css` é parte do core. Pode ser absorvido pelo
      `modern-ui.css` ou virar `extensions-v2.css` com o mesmo padrão
      aditivo.

17. **Extrair tokens de design**
    - Criar um arquivo `css/design-tokens.css` só com `:root` definindo
      todas as cores, raios, sombras, durations. `modern-ui.css` e
      `style.css` consumiriam.

18. **Documentar `mui-` API**
    - Gerar um Storybook-like simples (HTML estático em
      `docs/components.html`) com cada componente do overlay e seus
      modificadores.

19. **A11y audit**
    - Verificar contraste em todos os gradient texts (especialmente
      light theme).
    - Garantir `focus-visible` em todos os botões/inputs.
    - Testar com leitor de tela: ARIA labels nos toasts e FAB já
      existem; estender para o command palette (results como
      `role="option"`).

20. **Testes visuais (regressão)**
    - Adicionar Playwright/Percy screenshot tests para as 8 páginas
      principais em dark + light.

### 📦 Quando subir para v4

Se essas melhorias acumularem o suficiente (5-6 itens grandes),
considerar:
- Mover Chart.js para self-hosted (`vendor/chart.umd.min.js`) para
  funcionar 100% offline.
- Quebrar `modern-ui.css` em módulos: `modern-ui.core.css`,
  `modern-ui.dashboard.css`, `modern-ui.power.css`, etc.
- Migrar `modern-ui.js` para módulo ES (`<script type="module">`).

---

## 8. Como reverter

Caso algo dê problema:

1. No `index.html` remover:
   ```html
   <link rel="stylesheet" href="css/modern-ui.css?v=3">
   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
   <script src="js/modern-ui.js?v=3" defer></script>
   ```
2. Deletar `css/modern-ui.css` e `js/modern-ui.js`.
3. No `sw.js` baixar `CACHE_NAME` para `'booklist-v49'` (ou versão base) e remover os
   dois paths do `APP_SHELL`.

Pronto. Zero linha tocada no código original.

---

## 9. Resumo executivo

- **Arquivos criados**: 2 (CSS + JS) + este `.md`.
- **Arquivos editados**: 5 (`index.html`, `sw.js`, `js/personal.js`, `js/features.js`, `js/gamification.js`).
- **Linhas adicionadas**: ~3.000 (CSS) + ~1.600 (JS).
- **Linhas removidas dos arquivos originais**: 0.
- **Bibliotecas externas**: 1 (Chart.js via CDN).
- **Compatibilidade**: Chrome/Edge/Firefox/Safari modernos.
- **Reversibilidade**: total.

---

## 💎 10. Três Grandes Recursos Modernos (v69)

### 🌳 Gamificação Avançada: Árvore de Habilidades RPG (Skill Tree 3D/2D)
*   **Física Quântica de Partículas:** Renderização em Canvas 2D integrada no painel do *Life OS Quests* com simulação de molas vetoriais (atração a âncoras ideais, repulsão de proximidade e arrasto interativo de mouse/toque) herdada da física de topologia.
*   **Progressão & Pontos:** O usuário acumula 1 Ponto de Habilidade a cada nível alcançado (`Disponíveis = Nível - 1 - Gastos`).
*   **Caminhos e Árvores (9 Nodos):**
    1.  **Foco (🧘 Iniciado, 📥 Mestre, ✨ Guru):** Bônus cumulativos de XP (+10% Bookmarks, +25% Global) e liberação visual Aurora Violeta.
    2.  **Tech (🔧 Mão na Graxa, 🌐 Analista, 👑 Lorde):** Bônus de XP (+15% em Tickets), liberação de comandos e tema hacker no terminal.
    3.  **Finance (💰 Poupador, 🛡️ Consumidor, 🔥 Magnata):** Bônus de XP (+10% Financeiro, +30% Metas) e liberação de simulador de juros compostos.
*   **Interface Premium:** Displays Nixie de pontos restantes, conectores brilhantes de neon em gradiente e gaveta glassmorphic interativa de bônus e requisitos.

### 🛡️ Inteligência Financeira: Visão "Safe to Spend" (Livre para Gastar)
*   **Algoritmo Preditivo Inteligente:** Calcula o valor real seguro livre para consumo deduzindo do saldo/receitas correntes (estimados no histórico se ausentes no mês) as despesas pagas e as despesas recorrentes previstas em aberto (identificando lançamentos marcados como `recurring: true` nos últimos 6 meses e testando se já foram pagos no mês atual).
*   **Interface Estelar:** Barra/Gauge radial neon com gradiente responsivo (Verde esmeralda para excelente, Azul para moderado, Amarelo para atenção, Vermelho para limite ultrapassado).
*   **Gaveta Expansível:** Lista retroalimentada detalhando previsões pendentes individuais no mês atual com ícones de área e emoji.

### ⏳ Histórico Dinâmico: Máquina do Tempo (Time-Travel History)
*   **Interceptador no Storage:** Implementação ao nível do IndexedDB/Storage que retrocede os dados exibidos globalmente no aplicativo se `window.TimeTravelDate` estiver ativo. Filtra instantaneamente notas, marcadores, logs de hábitos, diários e finanças sem tocar em nenhuma linha de renderização individual.
*   **Console Quântico Analógico:** Painel de controle sci-fi adicionado ao Power Hub. Inclui display Nixie retro-futurista da data destino, controle range slider deslizante suave das datas e radar de ondas temporal brilhante com ping pulsante.
*   **Holograma de Comparação:** Displays dinâmicos que contrastam a quantidade de dados arquivados no passado selecionado contra o volume total do presente, atualizando-se de forma assíncrona enquanto o usuário desliza o controle.
