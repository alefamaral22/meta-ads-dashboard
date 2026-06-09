# Task: Otimizar Orcamento

**Agent:** budget-optimizer
**elicit:** false

## Objetivo
Analisar distribuicao atual do orcamento e recomendar ajustes para maximizar ROAS.

## Passos

1. Buscar todas campanhas com status ACTIVE
2. Buscar insights dos ultimos 7 dias por campanha
3. Calcular ROAS e CPA por campanha
4. Classificar campanhas em 3 grupos:
   - ESCALAR: ROAS >= 3x por 3+ dias
   - MANTER: ROAS entre 1x-3x
   - PAUSAR: ROAS < 1x ou sem conversoes
5. Calcular redistribuicao ideal do orcamento total
6. Apresentar plano de acao com riscos

## Regras de Escalonamento

- Aumentar no maximo 20% do orcamento por vez
- Aguardar 48h entre aumentos
- Nunca escalar sem dados de pelo menos 3 dias

## Output esperado

```
PLANO DE OTIMIZACAO DE ORCAMENTO
Orcamento diario atual: R$XXX,XX

ACOES RECOMENDADAS:
────────────────────
ESCALAR (aumentar 20%):
  ✅ [Campanha A] ROAS: 4.5x | R$50 → R$60/dia

MANTER:
  ⚠️ [Campanha B] ROAS: 2.1x | Monitorar 48h

PAUSAR:
  ❌ [Campanha C] ROAS: 0.6x | Economiza R$30/dia

REDISTRIBUICAO SUGERIDA:
  Campanha A: R$60 (+R$10)
  Campanha B: R$50 (igual)
  Campanha C: PAUSADA (-R$30)
  TOTAL: R$110/dia (era R$130/dia)

ECONOMIA PROJETADA: R$20/dia
ROAS PROJETADO: +0.8x de melhora
```
