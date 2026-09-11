# Ideias de Novas Features para o BookList

## 1. Inteligência e Automação (Aproveitando seu WebAI local)
*   **Chat Local com o "Segundo Cérebro" (Local RAG):** Integração com um modelo minúsculo gerador (como WebLLM) para criar um assistente de chat que lê notas, tickets e runbooks e responde perguntas diretas (ex: "Qual foi a solução que apliquei no servidor da empresa X mês passado?").
*   **Auto-Categorização de Inbox / Bookmarks:** Ao enviar um link pelo Clipper (Extensão do Navegador), a IA local lê o conteúdo da página, extrai palavras-chave e sugere automaticamente a pasta, as tags e os links Wiki (`[[ ]]`) relacionados.
*   **Detector de Anomalias Financeiras / Hábitos:** Script que roda no final do dia analisando o módulo `money` e alerta se gastos com infraestrutura (ex: AWS, VPS) ou lazer estão fugindo da média histórica usando um desvio padrão simples.

## 2. Features Técnicas e de Infraestrutura
*   **Network Topology Visualizer:** Expansão do motor `GraphView` 3D para os módulos de `networks` e `equipment`. Criação de uma visualização gráfica interativa da rede dos clientes (Roteador de Borda -> Switch Core -> Unifi -> Laptops), útil para identificar pontos únicos de falha (SPOF) visualmente.

## 3. UX / UI Premium (Levando o "Modern UI" ao extremo)
*   **Command Palette Global (Estilo Raycast/Spotlight):** Atalho global (`Ctrl + K` ou `Cmd + K`) que abre uma barra central flutuante com fundo escurecido/blur. Permite criar tickets (`> nova os`), rodar queries customizadas do `QueryView` e buscar/abrir notas e clientes instantaneamente sem usar o mouse.
*   **Dashboard Modular (Drag & Drop):** Dashboard transformado em uma grade magnética (Grid CSS), permitindo arrastar, soltar e redimensionar cartões (Gráficos, Inbox, Status de OS). O layout final é salvo nas coordenadas do IndexedDB.
*   **Infinite Canvas (Quadro Branco):** Modo de quadro infinito (estilo Obsidian Canvas ou Miro) onde é possível arrastar notas, imagens e interligar com setas desenhadas à mão (SVG/Canvas HTML5), excelente para desenhar arquiteturas de rede.
*   **Heatmap Calendar (Estilo GitHub):** Grade anual exibida no perfil ou dashboard de hábitos/estudos, com pequenos quadrados que brilham (efeito neon) mais forte nos dias em que foram completadas muitas tarefas, ordens de serviço ou notas.

## 4. Segurança e Privacidade Avançada
*   **Panic Button / Duress PIN (PIN de Coação):** Digitar um PIN alternativo falso abre um "Cofre Falso" com notas genéricas, ou aciona um script que apaga o IndexedDB local instantaneamente, protegendo contra acessos forçados.
*   **Esteganografia no Cofre de Mídias:** Habilidade de embutir chaves SSH, senhas ou notas curtas ocultas dentro dos pixels de uma imagem através do `MediaManager`, usando a senha correta para extrair.
*   **Sessão Autodestrutiva (Incognito Mode Local):** Botão que recarrega o app isolando o IndexedDB na memória RAM, impedindo sincronização com o Supabase e apagando rastros ao fechar a aba.

## 5. Interoperabilidade e Dados
*   **Exportação em SQLite via WebAssembly:** Compilar o IndexedDB inteiro em um único arquivo `.sqlite` (usando `sql.js`), permitindo rodar queries avançadas em ferramentas nativas (DBeaver, DataGrip), mantendo também a opção padrão de exportação em `.json`.

## 6. Automação e "Node-based Scripting"
*   **Mini "N8N/Make" Integrado (Visual Workflow Builder):** Um canvas no hub de automação para ligar blocos visuais e criar fluxos rodando inteiramente no cliente (Ex: `[Gatilho: Email na Inbox] -> [Filtro de IA] -> [Ação: Criar Ticket]`).

## 7. Visualização de Dados Extrema (Analytics Pessoal)
*   **Diagrama de Sankey Financeiro:** Gráfico de fluxo gerado automaticamente para o módulo `money` mostrando visualmente a entrada e a saída de recursos (ex: `[Salário] ---> [Impostos, AWS, Lazer]`), complementar aos gráficos atuais.
*   **Time-Travel Debugger (Máquina do Tempo):** Controle deslizante que altera toda a UI para o estado exato de uma data no passado (dashboard, tickets e conta bancária) usando os logs de `updatedAt`.

## 8. Markdown e PKM (Personal Knowledge Management)
*   **Dataview Tables (Banco de Dados embutido na Nota):** Tabelas estilo Excel renderizadas e editáveis diretamente dentro das notas Markdown via `QueryView`, onde alterar uma célula atualiza o registro no IndexedDB automaticamente.
*   **WebRTC Peer-to-Peer Share:** Geração de um link efêmero que conecta o navegador de um cliente diretamente ao seu via WebRTC, permitindo compartilhar o status de um ticket ou orçamento em tempo real sem passar pelo Supabase.

## 9. Ferramentas Práticas para Desenvolvedores/Sysadmin (Toolbox)
*   **Edição Direta no Disco (File System Access API):** Usando a API nativa dos navegadores modernos, permita que o BookList acesse pastas reais do Windows (ex: `C:\projetos\scripts`). Você poderá abrir, editar e salvar arquivos (como scripts Python ou `.bat`) diretamente no disco usando o editor do BookList, como se fosse um VS Code ultraleve.
*   **Construtor Visual de Comandos CLI:** Um utilitário visual onde você seleciona opções em caixas de seleção e dropdowns para construir comandos complexos (como `ffmpeg`, `tar`, `rsync`, `docker run`), gerando a string de comando perfeita pronta para copiar e colar no terminal.
*   **Documentação Offline (Alternativa ao Dash/Zeal):** Habilite o download de pacotes offline de documentação (Docsets de Python, React, AWS, Docker). Integrado ao `Ctrl+K`, permite buscas instantâneas e locais em documentações técnicas mesmo sem conexão com a internet em um datacenter.

## 10. Gestão Pessoal e Lifestyle
*   **Radar de Equilíbrio das "Áreas da Vida" (Chart.js Radar):** Gráfico de teia no Dashboard que calcula a pontuação de cada área (Saúde, Lazer, Finanças) baseada em hábitos, metas e finanças dos últimos 30 dias, mostrando desequilíbrios visuais na rotina.
*   **Automação de Tracking (Web Scraper via Extensão):** A extensão do navegador detecta acessos a sites de consumo (ex: leitura de mangás ou vídeos), raspa o número do capítulo silenciosamente e atualiza o módulo `tracker` automaticamente.
*   **Motor de Correlação (Humor vs. Hábitos/Dinheiro):** Algoritmo que cruza os dados de humor/energia do `journal` com gastos e hábitos, gerando insights automáticos (ex: "Beber água eleva a média de humor em 30%").
*   **Visão Financeira "Safe to Spend" (Livre para Gastar):** Em vez do saldo bruto, o sistema subtrai todas as despesas mensais recorrentes conhecidas do salário atual e exibe apenas o valor que está realmente livre para consumo discricionário.
*   **Cápsula do Tempo (On this Day...):** Widget no Dashboard que resgata aleatoriamente entradas marcantes do Diário, fotos ou metas concluídas há exatamente 1, 2 ou 3 anos.
*   **"Spotify Wrapped" da sua Vida (Retrospectiva Anual):** Script gerador de apresentação interativa rodando todo dia 31 de Dezembro, resumindo capítulos lidos, dinheiro salvo, quilômetros corridos e meses mais produtivos do ano.
*   **Diário em Áudio com Auto-Resumo (Local AI):** Gravação de voz direto no navegador, convertida para texto via Speech API e resumida em tópicos pela IA Local, extraindo inclusive tarefas pendentes e jogando-as para a Inbox.
*   **Wishlist com Tracker de Preços Automático:** Módulo para salvar links de lojas (Amazon, Kabum). O Service Worker faz fetch silencioso periodicamente e notifica no Dashboard se o preço cair abaixo do limite desejado.
*   **Metas de "Limite" (Anti-Goals):** Acompanhamento visual reverso para conter excessos (ex: limite de R$ 200 em iFood). A barra verde fica vermelha e com efeito "Glitch" se o limite mensal for rompido.
*   **Timeline Unificada ("Life Feed"):** Visualização estilo feed do Twitter que intercala cronologicamente todos os eventos do dia: hábitos concluídos, compras feitas, capítulos lidos e entradas de diário em uma única narrativa.

## 11. Gamificação e Evolução Pessoal (Sem ser clichê)
*   **Árvore de Habilidades Estilo RPG (Skill Tree):** Utiliza o motor de grafo 3D (`GraphView`) para criar uma Árvore de Habilidades (estilo Path of Exile). Ler documentações ou fechar chamados dá XP em ramificações específicas (Ex: "Sabedoria" ou "Infraestrutura"), abrindo novos "nodos" de conhecimento de forma visualmente imersiva.
*   **Sistema de "Quests" com Recompensas Físicas:** Transforma tarefas complexas da Inbox em *Quests* com ranks de dificuldade (C, B, A, S). Completar Missões Rank S (ex: "Migrar a infraestrutura do cliente Z") rende moedas virtuais que podem ser trocadas por recompensas predefinidas na vida real (ex: "Comprar um jogo novo sem culpa").
*   **Log de Decisões (Mental Models & Decision Tracker):** Um módulo dedicado a registrar grandes decisões (ex: "Investi em um servidor local em vez de nuvem"). Após meses, o sistema obriga uma revisão para avaliar se a decisão deu lucro ou prejuízo, treinando a intuição e os modelos mentais com dados reais.

## 12. Consumo de Mídia e Conhecimento "Deep Learning"
*   **Leitor de PDF/Epub Embutido com "Auto-Extração":** Integração com `PDF.js` ou `Epub.js` para ler livros técnicos direto no BookList. Ao grifar uma frase, o sistema extrai o texto automaticamente, salva no Vault com a página de referência e a tag do livro, centralizando os estudos.
*   **Mapas Mentais Gerados Instantaneamente:** Escrever notas em tópicos de lista (Markdown bullets) aciona um motor visual (como `markmap` ou `d3.js`) que desenha um Mapa Mental colorido e expansível automaticamente ao lado do texto em tempo real.

## 13. Integração Física e Modo de Foco
*   **Disparo de Pacotes Wake-On-LAN (WoL):** Botões no Dashboard para ligar servidores físicos da sua casa. Como você utiliza OpenVPN para acessar a rede interna pela operadora, o BookList fará um fetch para um gateway interno (ex: um Raspberry Pi na rede local) que disparará o Magic Packet real para ligar o hardware.
*   **Modo "Cockpit" (Full-Screen Hacker Mode):** Atalho (`F11`) que oculta toda a interface (menus, pastas). Resta apenas uma tela preta com fundo aurora suave, um relógio neon minimalista, a "Quest" principal do dia e o editor de código. Imersão total e zero distrações.
*   **Web-Scraping Pessoal (Sentinela de Sites):** Download em background do HTML de sites de interesse para alertar sobre mudanças (ex: novos capítulos no `verdinha.wtf`). Como exige login, o scraping é feito silenciosamente através do background worker da Extensão do Navegador, aproveitando a sua própria sessão autenticada e cookies de forma transparente e segura.
