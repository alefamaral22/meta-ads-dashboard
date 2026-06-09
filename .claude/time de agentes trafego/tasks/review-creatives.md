# Task: Revisar Criativos

**Agent:** creative-reviewer
**elicit:** false

## Objetivo
Analisar performance dos criativos ativos e identificar quais trocar, manter ou escalar.

## Passos

1. Buscar todos os ad sets ativos via `getAdSets()`
2. Para cada ad set, buscar ads com `getAds()`
3. Buscar insights por ad com `getAdInsights()`
4. Calcular por criativo:
   - CTR
   - Frequencia (impressoes / alcance)
   - CPC
   - Taxa de conversao
5. Classificar cada criativo:
   - BOM: CTR > 2% e frequencia < 2
   - SATURADO: frequencia > 3 (trocar urgente)
   - RUIM: CTR < 0.5%

## Output esperado

```
ANALISE DE CRIATIVOS — [DATA]

CRIATIVOS SAUDAVEIS:
────────────────────
✅ [Nome do anuncio]
   CTR: 2.8% | Frequencia: 1.4 | CPC: R$0.80
   Status: Performando bem — manter

CRIATIVOS SATURADOS (TROCAR):
──────────────────────────────
⚠️ [Nome do anuncio]
   CTR: 0.9% (era 2.1% ha 2 semanas)
   Frequencia: 4.2 — as pessoas ja viram demais
   Acao: Trocar criativo esta semana

CRIATIVOS RUINS (PAUSAR):
──────────────────────────
❌ [Nome do anuncio]
   CTR: 0.3% | R$45 gastos | 0 conversoes
   Acao: Pausar imediatamente

SUGESTOES PARA NOVOS CRIATIVOS:
────────────────────────────────
Baseado nos que funcionaram:
→ Gancho: [elemento que funcionou]
→ Formato: [imagem/video/carrossel]
→ Publico: [que respondeu melhor]
```
