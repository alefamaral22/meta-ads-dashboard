# Design — Time de Agentes de IA

**Data:** 2026-05-16  
**Status:** Aprovado  
**Arquivo de saída:** `agentes.html` + novas rotas em `server.mjs`

---

## Visão Geral

Nova página `agentes.html` integrada ao dashboard Meta Ads. Apresenta 6 agentes de IA especializados em tráfego pago como "funcionários virtuais". Cada agente analisa dados reais da Meta Ads API, fala em linguagem simples e sugere ações que só são executadas após autorização explícita do usuário.

---

## Layout

### Estrutura de 2 colunas

```
┌─────────────────────────────────────────────────────┐
│  TOPBAR: Logo | Dashboard | 🤖 Time de Agentes | Vendas │
├──────────────┬──────────────────────────────────────┤
│              │  HEADER DO AGENTE ATIVO               │
│  SIDEBAR     │  (robô grande + nome + botão analisar)│
│  (230px)     ├──────────────────────────────────────┤
│              │                                       │
│  6 agentes   │  ÁREA DE CHAT                        │
│  com robô    │  (mensagens + cards de ação)          │
│  + status    │                                       │
│  + badge     ├──────────────────────────────────────┤
│              │  STATUS BAR (próxima análise auto)    │
└──────────────┴──────────────────────────────────────┘
```

### Sidebar
- Cada item: robô humanóide SVG (38×38px) + nome + cargo + dot de status + badge de pendências
- Status: 🟢 verde (análise pronta), 🟡 amarelo pulsando (analisando), ⚫ cinza (aguardando)
- Badge vermelho aparece quando há ações aguardando autorização

### Área principal
- **Header:** robô (52×52px) + nome + cargo + timestamp da última análise + botão "🔄 Analisar agora"
- **Chat:** balões do agente explicando insights em português simples + cards de ação
- **Status bar:** horário da próxima análise automática + contagem total de pendências

---

## Os 6 Agentes

| ID | Nome | Cor | Cargo | Tipo de análise |
|----|------|-----|-------|-----------------|
| `trace` | Trace | Azul (#4f6ef7→#7c5cfc) | Analista de Tráfego | Automática (dados Meta) |
| `buck` | Buck | Dourado (#f7c244→#f59e0b) | Otimizador de Orçamento | Automática (dados Meta) |
| `cris` | Cris | Roxo (#a855f7→#7c3aed) | Revisora de Criativos | Automática (dados Meta) |
| `rex` | Rex | Verde (#22d3a5→#059669) | Gerador de Relatórios | Manual (sob demanda) |
| `ada` | Ada | Vermelho (#f75959→#dc2626) | Criadora de Anúncios | Manual (sob demanda) |
| `cleo` | Cleo | Azul claro (#38bdf8→#0369a1) | Diretora de Criativos | Manual (sob demanda) |

### Ícones
Cada agente tem um robô humanóide SVG único — rosto com proporções humanas, armadura futurista branca/metálica com cor de acento própria, olhos brilhantes com efeito glow (filter SVG). Estilo inspirado em robôs humanóides realistas.

---

## Fluxo de Análise Automática

**Agentes automáticos:** Trace, Buck, Cris  
**Horário:** 08:00 todos os dias (via `setTimeout` no servidor, igual ao `agendarProximoRefresh` existente)  
**Armazenamento:** `/tmp/agents_data.json` no Vercel, pasta do projeto localmente

### Pipeline por agente automático:
1. Busca dados da Meta Ads API (últimos 7 dias)
2. Monta prompt compacto com métricas relevantes
3. Chama Claude Haiku (`claude-haiku-4-5-20251001`)
4. Recebe JSON com array de mensagens e ações sugeridas
5. Salva resultado em `agents_data.json`
6. Frontend exibe ao abrir a página

### Formato de dados salvo (`agents_data.json`):
```json
{
  "trace": {
    "generated_at": "2026-05-16T08:00:00Z",
    "status": "ready",
    "messages": [
      { "text": "Analisei suas campanhas...", "type": "text" },
      {
        "type": "action",
        "priority": "urgent",
        "title": "Pausar campanha X",
        "description": "Frequência 4.2 — público saturado",
        "action_type": "pause_campaign",
        "action_payload": { "campaign_id": "123" },
        "status": "pending"
      }
    ]
  },
  "buck": { ... },
  "cris": { ... },
  "rex": { "generated_at": null, "status": "idle", "messages": [] },
  "ada": { "generated_at": null, "status": "idle", "messages": [] },
  "cleo": { "generated_at": null, "status": "idle", "messages": [] }
}
```

---

## Fluxo de Autorização

1. Card de ação aparece no chat com botões **✓ Autorizar** / **✗ Ignorar**
2. Usuário clica **Autorizar** → frontend chama `POST /api/agents/:id/action`
3. Servidor executa via Meta API (ex: pausar campanha, alterar orçamento)
4. Resposta atualiza o card para "✅ Executado" e agente envia mensagem de confirmação
5. Usuário clica **Ignorar** → card fica marcado como "ignorado", sem executar nada

### Tipos de ação suportados na v1:
- `pause_campaign` — pausar campanha
- `resume_campaign` — reativar campanha
- `update_budget` — alterar orçamento diário de um conjunto de anúncios
- `info_only` — apenas informação, sem ação executável (não mostra botões)

---

## Backend — Novas Rotas (`server.mjs`)

### `GET /api/agents/status`
Retorna o estado atual de todos os agentes (última análise, status, contagem de pendências).

### `POST /api/agents/:id/analyze`
Dispara análise manual de um agente específico. Aceita `{ accountId }` no body. Retorna os dados gerados.

### `POST /api/agents/:id/action`
Executa uma ação autorizada. Body: `{ message_index, confirmed: true }`.  
Usa a Meta API para executar e salva o resultado em `agents_data.json`.

### Agendador automático
Função `agendarAnaliseAgentes()` adicionada ao `server.mjs`, rodando às 08:00 diariamente — mesmo padrão do `agendarProximoRefresh()` já existente.

---

## Prompts dos Agentes

Cada agente tem um prompt especializado enviado ao Claude Haiku. O prompt instrui o modelo a retornar **apenas JSON válido** com array `messages`. Exemplo para Trace:

```
Você é Trace, analista sênior de tráfego pago. Analise os dados e retorne APENAS JSON:
{"messages":[
  {"type":"text","text":"mensagem em português simples"},
  {"type":"action","priority":"urgent|opportunity|suggestion",
   "title":"título curto","description":"contexto com números reais",
   "action_type":"pause_campaign|update_budget|info_only",
   "action_payload":{...}}
]}
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `agentes.html` | Criar — página completa dos agentes |
| `server.mjs` | Adicionar 3 rotas + agendador de análise |
| `vercel.json` | Adicionar rota `/agentes` → `agentes.html` |

---

## Fora de Escopo (v1)

- Agentes conversando entre si
- Histórico de análises anteriores
- Notificações push/email
- Criação de campanhas completas via Ada (apenas textos de anúncio)
- Interface mobile otimizada para a página de agentes
