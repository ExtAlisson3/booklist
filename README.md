# BookList

**Seu espaço para conhecimento, organização pessoal e trabalho técnico.**

O **BookList** é uma aplicação web em português (pt-BR) que reúne notas e conhecimento, links, planejamento, acompanhamento de mídias, finanças e ferramentas de TI em um único ambiente. A proposta é capturar, conectar e recuperar informações sem depender de diversos aplicativos separados.

O projeto utiliza uma interface **SPA/PWA** em HTML, CSS e JavaScript, com armazenamento no navegador por **IndexedDB**, sincronização com **Supabase** e serviços de apoio em **Node.js**. A arquitetura evita a obrigatoriedade de bundler no frontend e privilegia controle dos dados e implantação simples.

> **Estado do projeto:** em evolução ativa. A documentação fornecida descreve uma entrega local validada em setembro de 2026 e um redesign v2 com entregas registradas posteriormente. Nem todos os recursos foram validados em produção ou em todos os navegadores.

## Funcionalidades

| Área | Recursos documentados |
| --- | --- |
| **Conhecimento** | Notas Markdown, WikiLinks, backlinks, busca, anexos, documentos e organização de links |
| **Visualização** | Grafo de relações (2D/3D), conexões entre itens e navegação contextual |
| **Produtividade** | Captura rápida, tarefas, projetos, calendário, diário, hábitos, metas e revisão de estudos |
| **Mídias** | Acompanhamento de livros, animes, mangás, filmes e séries; catálogos e histórico de progresso |
| **Finanças** | Lançamentos, contas, cartões, orçamentos, relatórios e importação de extratos |
| **TI e suporte** | Clientes, equipamentos, registros técnicos, procedimentos, orçamentos, inventário de rede e utilitários |
| **Privacidade** | Cofre criptografado, backup e sincronização com tratamento de conflitos |
| **Operação** | Monitoramento da VPS, verificações de integridade, notificações internas e publicação versionada |

Alguns recursos dependem de configuração de serviços externos, bibliotecas ou ambiente de servidor.

## Tecnologias e princípios

- **Frontend:** HTML5, CSS3 e JavaScript modular, sem etapa obrigatória de compilação da aplicação.
- **Persistência local:** IndexedDB, com mecanismos de backup, importação e exportação.
- **Sincronização:** Supabase (Auth e APIs de dados), quando configurado.
- **Servidor:** Node.js para servir a aplicação e recursos privados.
- **PWA:** manifesto e service worker.
- **Interface:** módulos de edição Markdown, visualização de grafos e componentes próprios.
- **Implantação privada:** suporte documentado a VPS Linux e acesso por Tailscale.

O código-fonte do projeto pode ser público, **mas isso não significa que a instância, os dados pessoais ou os serviços privados estejam publicamente acessíveis**.

## Executando localmente

É necessário ter uma versão compatível do Node.js instalada. Consulte também os arquivos de configuração de exemplo do projeto antes de habilitar integrações.

```bash
git clone https://github.com/ExtAlisson3/booklist.git
cd booklist
npm run check
npm start
```

Com o servidor iniciado, acesse:

```text
http://127.0.0.1:8766/
```

Os comandos e a porta são os descritos na documentação da entrega de setembro de 2026. Verifique o `package.json` da revisão clonada caso haja mudanças.

## Organização do código

```text
index.html             # Entrada da aplicação
css/                   # Estilos e componentes visuais
js/                    # Aplicação e lógica de negócio
js/core/               # Roteamento e serviços compartilhados da v2
js/modules/            # Módulos auxiliares
js/features/           # Domínios da experiência v2
browser-extension/     # Extensão de captura para navegador
scripts/               # Verificação, operação e monitoramento
tests/                 # Testes automatizados
deploy/                 # Implantação e rollback
supabase/              # Migrações e configuração do banco
sw.js                  # Service worker
manifest.webmanifest   # Manifesto PWA
```

A estrutura pode variar entre versões legadas e o redesign.

## Qualidade e testes

O projeto documenta verificações automatizadas de sintaxe, consistência dos arquivos da PWA, persistência, importação/exportação, cofre e sincronização. Uma entrega local de **25/09/2026** registrou **51 testes aprovados**; esse número é histórico e não deve ser interpretado como resultado de uma execução recente neste repositório.

Antes de propor uma alteração, execute:

```bash
npm run check
```

## Privacidade e segurança

- Não publique credenciais, tokens, arquivos `.env`, backups reais nem dados pessoais no repositório.
- Mantenha chaves de servidor e diretórios de backup fora da pasta servida ao navegador.
- Configure autenticação e políticas de acesso adequadas no Supabase.
- Teste operações de importação e restauração em ambiente isolado antes de usá-las sobre dados reais.
- O acesso à aplicação em produção é descrito como privado; a disponibilização pública do código não torna os dados públicos.

## Contribuições e roadmap

O projeto é mantido por **[@ExtAlisson3](https://github.com/ExtAlisson3)** e continua evoluindo. Issues com reproduções de bugs, sugestões justificadas e melhorias de documentação podem ajudar a orientar o desenvolvimento.

Prioridades documentadas incluem simplificação de código legado, consistência da experiência, proteção de dados, testes e manutenção dos módulos.

Antes de enviar um pull request, descreva o problema, o comportamento esperado e as verificações realizadas.

## Licença

**Licença a definir.** Até a inclusão de um arquivo `LICENSE`, não presuma que o código possa ser copiado, modificado ou redistribuído livremente. Se o objetivo for colaboração open source, escolha e publique uma licença compatível com esse propósito.

---

**Mantenedor:** [ExtAlisson3](https://github.com/ExtAlisson3)
