# BookList Clipper — Extensão de Navegador

Salva bookmarks rapidamente e clipa páginas/seleções diretamente para o BookList.

## Recursos

- **🔖 Salvar bookmark** da página atual em 1 clique (popup)
- **✂️ Web Clipper** — captura seleção ou página inteira como nota
- **Menu de contexto** (clique direito):
  - Salvar link
  - Salvar seleção como nota
- **Sync com Supabase** — usa a mesma tabela `booklist_sync_documents` do app web
- **Fila offline** — se você não estiver logado, fica na fila e sincroniza quando configurar

## Instalação (modo desenvolvedor)

### Chrome / Edge / Brave / Opera
1. Abra `chrome://extensions/`
2. Ative **Modo desenvolvedor** (canto superior direito)
3. Clique **Carregar sem compactação**
4. Selecione a pasta `browser-extension/` deste projeto
5. Pin o ícone na barra para acesso rápido

### Firefox
1. Abra `about:debugging#/runtime/this-firefox`
2. Clique **Carregar add-on temporário**
3. Selecione `manifest.json` dentro de `browser-extension/`

## Configuração

1. Clique no ícone da extensão
2. Aba **⚙️** — preencha:
   - Supabase URL (mesma do app web)
   - Anon Key
   - E-mail e senha do seu usuário Supabase
3. Clique **Salvar e logar**

A partir daí, qualquer bookmark salvo via extensão aparece no app web automaticamente após o próximo sync.

## Ícone

O `icons/icon.png` é um placeholder — substitua por um PNG 128x128 do logo do BookList se quiser.

## Estrutura

```
browser-extension/
├── manifest.json   # Manifest V3
├── popup.html      # UI do popup
├── popup.js        # Lógica da UI
├── background.js   # Service worker (sync Supabase + fila offline + context menu)
├── icons/
│   └── icon.png    # Ícone (placeholder)
└── README.md       # Este arquivo
```

## Como funciona o sync

A extensão usa o mesmo modelo `booklist_sync_documents (doc_key, payload jsonb)` do app principal:
1. Ao salvar, faz GET do array existente em `payload`
2. Adiciona o novo item no início (unshift)
3. Faz upsert do array completo

Se algo der errado (offline, token expirado), o item entra na `pendingQueue` em `chrome.storage.local` e é re-tentado a cada 5 minutos.

## Limitações conhecidas

- O ícone padrão é placeholder; substitua por arte do BookList.
- Sem refresh automático de token: se o JWT expirar (>1h), abra o popup e logue de novo.
- Atalhos de teclado (Ctrl+Shift+S etc) podem ser configurados em `chrome://extensions/shortcuts` após carregar.
