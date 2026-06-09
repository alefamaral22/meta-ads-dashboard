# Task: Gerar Relatorio de Performance

**Agent:** report-writer
**elicit:** false

## Objetivo
Gerar relatorio completo de performance consolidando dados de campanhas, criativos e orcamento.

## Passos

1. Definir periodo (default: ultimos 7 dias)
2. Buscar dados via MetaAdsClient:
   - `getTotalSpend()` — gasto total
   - `getCampaignInsights()` — por campanha
   - `getAdInsights()` — por criativo
3. Calcular metricas consolidadas:
   - ROAS geral
   - Total de conversoes
   - CPA medio (Custo por Aquisicao)
   - Top 3 criativos
4. Comparar com periodo anterior (se disponivel)
5. Gerar relatorio no formato abaixo

## Formato do Relatorio

```
╔══════════════════════════════════════╗
║  RELATORIO META ADS — [PERIODO]      ║
╚══════════════════════════════════════╝

RESUMO EXECUTIVO
─────────────────
Total Investido:  R$XXX,XX
Total Receita:    R$XXX,XX
ROAS Geral:       X.Xx
Conversoes:       XX
CPA Medio:        R$XX,XX
Alcance:          XX pessoas

vs semana anterior: +X% receita / -X% CPA

CAMPANHAS
─────────
[tabela de campanhas]

TOP CRIATIVOS
─────────────
1. [nome] — CTR: X% | XX conversoes
2. [nome] — CTR: X% | XX conversoes

DISTRIBUICAO DE ORCAMENTO
──────────────────────────
[nome campanha]: R$XX (XX%)

RECOMENDACOES PARA PROXIMA SEMANA
───────────────────────────────────
1. ...
2. ...
3. ...
```
