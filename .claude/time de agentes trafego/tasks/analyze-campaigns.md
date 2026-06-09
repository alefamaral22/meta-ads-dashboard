# Task: Analisar Campanhas Meta Ads

**Agent:** traffic-analyst
**elicit:** false

## Objetivo
Buscar dados de todas as campanhas ativas e gerar analise de performance com recomendacoes.

## Passos

1. Carregar `MetaAdsClient` de `../lib/meta-ads-client.js`
2. Chamar `client.getCampaigns()` para listar campanhas
3. Chamar `client.getCampaignInsights({ dateRange: { since: 7_dias_atras, until: hoje } })`
4. Para cada campanha, calcular:
   - ROAS = action_values / spend
   - CTR = clicks / impressions * 100
   - Status: SAUDAVEL | ATENCAO | PAUSAR
5. Ordenar por ROAS decrescente
6. Gerar tabela de resultado:

```
| Campanha | Gasto | Conversoes | ROAS | CTR | Status     |
|----------|-------|------------|------|-----|------------|
| Nome...  | R$XX  | XX         | X.Xx | X%  | SAUDAVEL   |
```

7. Listar recomendacoes de acao por campanha

## Criterios de Status

| Status    | Condicao                          |
|-----------|-----------------------------------|
| SAUDAVEL  | ROAS >= 3x e CTR >= 1%            |
| ATENCAO   | ROAS entre 1x-3x ou CTR 0.5%-1%  |
| PAUSAR    | ROAS < 1x ou sem conversoes em 7d |

## Output esperado

```
ANALISE DE CAMPANHAS — Ultimos 7 dias
Conta: act_XXXXXXXXXX | Gasto total: R$XXX,XX

TOP CAMPANHAS:
1. [Nome] — ROAS: 4.2x | CTR: 2.1% | Gasto: R$120 ✅
2. [Nome] — ROAS: 2.8x | CTR: 1.4% | Gasto: R$80 ⚠️
3. [Nome] — ROAS: 0.8x | CTR: 0.3% | Gasto: R$40 ❌

RECOMENDACOES:
→ Escalar campanha 1 (ROAS excelente)
→ Revisar criativo da campanha 2 (CTR caindo)
→ PAUSAR campanha 3 imediatamente (perdendo dinheiro)
```
