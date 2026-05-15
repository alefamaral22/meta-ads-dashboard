# CLAUDE.md — Bitcoin Dashboard

## Sobre o projeto

Dashboard web sobre Bitcoin feito em HTML puro, CSS e JavaScript.
Sem frameworks, sem instalação — abre direto no navegador.

## Stack escolhida

| Camada | Tecnologia | Motivo |
|---|---|---|
| Estrutura | HTML5 | Base de toda página web |
| Estilo | CSS3 + variáveis CSS | Visual limpo sem dependências |
| Lógica | JavaScript puro (ES6+) | Sem necessidade de instalar nada |
| Gráficos | [Chart.js](https://www.chartjs.org/) via CDN | Gratuito, fácil, visual profissional |
| Dados | [CoinGecko API (pública)](https://www.coingecko.com/en/api) | Gratuita, sem autenticação |

## Endpoints da API utilizados

```
# Preço atual + variação 24h
GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true

# Dados históricos (gráficos)
GET https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7
GET https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365

# Período personalizado (seletor de datas)
GET https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=UNIX_TIMESTAMP&to=UNIX_TIMESTAMP
```

## Estrutura de arquivos

```
projeto claude code/
├── CLAUDE.md           ← este arquivo
├── plan.md             ← roteiro de desenvolvimento
├── index.html          ← página principal (único arquivo HTML)
├── style.css           ← todo o visual
└── app.js              ← toda a lógica e chamadas à API
```

## Regras de desenvolvimento

- **Sem frameworks JS** (sem React, Vue, etc.) — manter simples para iniciantes
- **Sem bundlers** (sem Webpack, Vite) — abrir o index.html direto no navegador deve funcionar
- **Chart.js via CDN** — não instalar, carregar via tag `<script>`
- **Mobile-friendly** — o layout deve funcionar bem em celular também
- **Sem backend** — toda a lógica roda no navegador do usuário
- **Tratamento de erros visível** — se a API falhar, mostrar mensagem clara ao usuário
- **Limite de requisições da API** — CoinGecko free tier permite ~30 req/min; usar cache local (localStorage) quando possível

## Padrões de código

- Funções com nomes em português descritivo: `buscarDadosSemana()`, `renderizarGrafico()`
- Comentários em português explicando o "por quê", não o "o quê"
- Variáveis em camelCase: `precoAtual`, `dadosHistoricos`
- CSS com variáveis no `:root` para cores e tipografia
- Nenhum `console.log` esquecido em produção

## Como rodar

1. Baixar ou clonar os arquivos
2. Abrir o arquivo `index.html` em qualquer navegador moderno
3. Pronto — não precisa instalar nada
