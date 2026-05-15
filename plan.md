# Plano de Desenvolvimento — Bitcoin Dashboard

> Objetivo: criar um dashboard web simples, bonito e funcional sobre Bitcoin,
> usando apenas HTML, CSS e JavaScript, com dados reais da CoinGecko API.

---

## Visão geral do que será construído

```
┌─────────────────────────────────────────────────────┐
│  🟠 Bitcoin Dashboard                    [atualizar] │
├──────────────┬──────────────┬──────────────┬────────┤
│  Preço atual │  Variação 24h│  Volume 24h  │  Mkt   │
│  $ 65.000    │   +2,4%      │  $ 30bi      │  Cap   │
├──────────────┴──────────────┴──────────────┴────────┤
│  [Seletor de período: 7D | 30D | 90D | 1A | Custom] │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Gráfico de linha — Variação de Preço              │
│   (período selecionado pelo usuário)                │
│                                                     │
├──────────────────────┬──────────────────────────────┤
│  Gráfico semanal     │  Gráfico anual               │
│  (últimos 7 dias)    │  (últimos 365 dias)          │
└──────────────────────┴──────────────────────────────┘
```

---

## Etapas de desenvolvimento

### Etapa 1 — Estrutura base (HTML + CSS)
**O que fazer:**
- Criar o arquivo `index.html` com a estrutura das seções
- Criar o arquivo `style.css` com paleta de cores e layout responsivo
- Carregar Chart.js via CDN no HTML

**Entregável:** página estática sem dados, mas com o visual pronto

**Critérios de conclusão:**
- [ ] Layout funciona no desktop e no celular
- [ ] Paleta de cores definida (tema escuro ou claro)
- [ ] Espaços reservados para os cards e gráficos visíveis

---

### Etapa 2 — Cards de resumo (preço atual e métricas)
**O que fazer:**
- Criar o arquivo `app.js`
- Chamar o endpoint `/simple/price` da CoinGecko
- Exibir nos cards: preço atual, variação 24h, volume e market cap
- Formatar números (ex: `$ 65.432,10` e `+2,4%`)
- Colorir a variação em verde (positiva) ou vermelho (negativa)

**Entregável:** cards com dados reais atualizando ao carregar a página

**Critérios de conclusão:**
- [ ] Dados carregam ao abrir a página
- [ ] Variação positiva aparece em verde, negativa em vermelho
- [ ] Estado de carregamento visível ("Buscando dados...")
- [ ] Mensagem de erro se a API não responder

---

### Etapa 3 — Gráfico de variação semanal
**O que fazer:**
- Chamar o endpoint `/market_chart?days=7`
- Processar os dados retornados (lista de [timestamp, preço])
- Renderizar gráfico de linha com Chart.js
- Formatar datas no eixo X (ex: "Seg 18/04")

**Entregável:** gráfico dos últimos 7 dias funcionando

**Critérios de conclusão:**
- [ ] Gráfico exibe os 7 dias anteriores
- [ ] Eixo Y mostra valores em dólar formatados
- [ ] Tooltip ao passar o mouse mostra data e preço

---

### Etapa 4 — Gráfico de variação anual
**O que fazer:**
- Chamar o endpoint `/market_chart?days=365`
- Renderizar segundo gráfico de linha com Chart.js
- Reduzir os pontos exibidos para não sobrecarregar (1 ponto por semana)

**Entregável:** gráfico do último ano funcionando ao lado do semanal

**Critérios de conclusão:**
- [ ] Gráfico exibe os últimos 12 meses
- [ ] Visual não fica poluído (pontos reduzidos)
- [ ] Responsivo — empilha abaixo do semanal no celular

---

### Etapa 5 — Seletor de período interativo
**O que fazer:**
- Adicionar botões de período rápido: 7D, 30D, 90D, 1A
- Adicionar seletor de data personalizado (campos "de" e "até")
- Ao mudar o período, buscar novos dados e atualizar o gráfico principal
- Usar o endpoint `/market_chart/range` para períodos customizados

**Entregável:** dashboard totalmente interativo

**Critérios de conclusão:**
- [ ] Botões 7D / 30D / 90D / 1A funcionam e atualizam o gráfico
- [ ] Seletor de data personalizado funciona
- [ ] Botão ativo fica destacado visualmente
- [ ] Datas futuras são bloqueadas no seletor

---

### Etapa 6 — Polimento e qualidade final
**O que fazer:**
- Adicionar animações suaves de transição nos gráficos
- Implementar cache simples com `localStorage` (evitar chamar a API repetidamente)
- Testar no celular
- Revisar acessibilidade básica (contraste, textos alternativos)

**Entregável:** versão final pronta para uso

**Critérios de conclusão:**
- [ ] Carregamento inicial é fluido e sem travamentos
- [ ] Não faz mais de 1 requisição por dado a cada 60 segundos
- [ ] Funciona em Chrome, Firefox e Safari
- [ ] Funciona em telas de 375px (celular pequeno) a 1440px (desktop)

---

## Ordem de implementação recomendada

```
Etapa 1 → Etapa 2 → Etapa 3 → Etapa 4 → Etapa 5 → Etapa 6
  HTML       API      Gráfico   Gráfico   Seletor   Polimento
  CSS       cards     7 dias    1 ano     período   e testes
```

> Cada etapa entrega algo visível e funcional — nunca ficamos
> com código pela metade antes de passar para o próximo passo.

---

## Riscos e observações

| Risco | Solução |
|---|---|
| CoinGecko bloquear por excesso de requisições | Cache no localStorage por 60s |
| API fora do ar | Mensagem de erro amigável + botão "tentar novamente" |
| Dados com muitos pontos deixando o gráfico lento | Reduzir amostragem para gráfico anual |
| Celulares com tela pequena | Layout responsivo com CSS Grid/Flexbox |
