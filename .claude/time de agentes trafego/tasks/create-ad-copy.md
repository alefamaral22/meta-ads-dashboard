# Task: Criar Copia de Anuncio

**Agent:** ad-creator
**elicit:** true

## Objetivo
Criar texto completo de anuncio (headline + corpo + CTA) otimizado para conversao.

## Elicitacao (perguntar ao usuario)

```
Para criar seu anuncio, preciso saber:

1. O que voce esta vendendo/promovendo?
2. Qual o objetivo? (vendas, leads, trafego, awareness)
3. Quem e seu publico? (idade, interesses, problema que tem)
4. Qual o diferencial do seu produto/servico?
5. Tem algum anuncio anterior que funcionou bem? (opcional)
```

## Passos (apos elicitacao)

1. Analisar criativos que performaram bem na conta (se disponivel)
2. Identificar angulo: DOR (problema) vs GANHO (beneficio)
3. Criar 3 versoes usando o framework:
   - Gancho → Problema → Solucao → Prova social → CTA

## Output esperado

```
ANUNCIO CRIADO — [OBJETIVO] | [PRODUTO]

═══ VERSAO A (Angulo: Dor) ══════════════
HEADLINE: [texto impactante — max 40 chars]
CORPO:
[Gancho — primeira linha que prende]

[Amplifica o problema]

[Apresenta solucao com beneficio claro]

[Prova social se tiver]

👉 [CTA]
═════════════════════════════════════════

═══ VERSAO B (Angulo: Ganho) ════════════
[mesma estrutura com angulo diferente]
═════════════════════════════════════════

═══ VERSAO C (Curiosidade/Pergunta) ═════
[mesma estrutura com gancho tipo pergunta]
═════════════════════════════════════════

RECOMENDACAO: Testar Versao A primeiro
MOTIVO: Baseado nos dados, anuncios com angulo de dor
        converteram X% mais nesta conta.
```
