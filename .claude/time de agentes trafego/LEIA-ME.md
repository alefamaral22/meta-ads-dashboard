# 📊 Time de Tráfego Pago — Meta Ads

Squad completo de agentes de IA para gerenciar campanhas no Meta Ads (Facebook/Instagram).

## Agentes incluídos

| Agente | Nome | O que faz |
|--------|------|-----------|
| `@traffic-analyst` | Trace | Analisa performance de campanhas |
| `@budget-optimizer` | Buck | Otimiza orçamento e decide o que escalar/pausar |
| `@creative-reviewer` | Cris | Identifica criativos que funcionam e os saturados |
| `@report-writer` | Rex | Gera relatórios diários, semanais e mensais |
| `@ad-creator` | Ada | Cria textos de anúncio e variações A/B |
| `@creative-director` | Cleo | Cria briefs completos para gravar vídeos |

---

## Instalação (2 minutos)

### Pré-requisitos
- [Node.js 18+](https://nodejs.org) instalado
- Claude Code instalado
- Conta no Meta Business Suite com acesso ao Gerenciador de Anúncios

### Passo a passo

**1. Baixe e descompacte a pasta**

Coloque a pasta `time-de-trafego-pago` em qualquer lugar da sua máquina.

**2. Abra o terminal dentro da pasta**

No Windows: clique com botão direito dentro da pasta > "Abrir no Terminal"

**3. Rode o instalador**

```bash
node instalar.js
```

O instalador vai:
- Instalar as dependências automaticamente
- Pedir suas credenciais da Meta (só na primeira vez)
- Criar o arquivo `.env` configurado

**4. Abra o Claude Code na pasta**

```bash
claude
```

---

## Como obter suas credenciais Meta

### META_ACCESS_TOKEN
1. Acesse [Meta Business Suite](https://business.facebook.com)
2. Configurações > Acesso à API
3. Gere um token com permissões: `ads_read` e `ads_management`

### META_AD_ACCOUNT_ID
1. Abra o [Gerenciador de Anúncios](https://adsmanager.facebook.com)
2. O ID aparece no topo da página no formato `act_XXXXXXXXXX`

---

## Como usar os agentes

Dentro do Claude Code, chame o agente pelo nome:

```
@traffic-analyst *analisar
```

### Comandos mais usados

```bash
# Análise de campanhas
@traffic-analyst *analisar
@traffic-analyst *analisar-periodo 2026-03-01 2026-03-31
@traffic-analyst *top-campanhas

# Orçamento
@budget-optimizer *analisar-orcamento
@budget-optimizer *pausar-perdas
@budget-optimizer *redistribuir

# Criativos
@creative-reviewer *revisar-criativos
@creative-reviewer *criativos-saturados

# Relatórios
@report-writer *relatorio-mensal
@report-writer *resumo-executivo

# Criar anúncios
@ad-creator *criar-anuncio "vendas" "meu produto"
@ad-creator *criar-variacoes 123456

# Vídeos
@creative-director *brief "produto" "objetivo"
@creative-director *gancho "produto"
```

---

## Estrutura da pasta

```
time-de-trafego-pago/
├── agents/           ← definições dos 6 agentes
├── lib/              ← cliente da Meta Ads API
├── tasks/            ← tarefas de cada agente
├── workflows/        ← fluxo completo de auditoria
├── .env.example      ← modelo de configuração
├── .env              ← suas credenciais (criado pelo instalador)
├── instalar.js       ← script de instalação
└── LEIA-ME.md        ← este arquivo
```

---

## Segurança

- O arquivo `.env` **nunca** deve ser compartilhado — ele fica só na sua máquina
- Não suba o `.env` para GitHub ou qualquer lugar público
- Se seu token vazar, revogue-o imediatamente no Meta Business Suite

---

Desenvolvido com AIOS — Sistema de Agentes de IA
