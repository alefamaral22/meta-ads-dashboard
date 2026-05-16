import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Carregar .env se existir
const __dirnameEarly = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirnameEarly, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k] = v.join('=');
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

const PIXEL_ID   = process.env.PIXEL_ID  || '672896704609252';
const META_TOKEN  = process.env.META_TOKEN;
const CAPI_URL   = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

const hash = (val) => val ? crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex') : undefined;

// No Vercel só /tmp é gravável; localmente usa a pasta do projeto
const isVercel = !!process.env.VERCEL;
const dataDir    = isVercel ? '/tmp' : __dirname;
const salesFile  = join(dataDir, 'sales_log.json');
const rawFile    = join(dataDir, 'meta_raw.json');
const statusFile = join(dataDir, 'refresh_status.json');
const recsFile   = join(dataDir, 'recs.json');

// ── estado de refresh ─────────────────────────────────────────────────────────
let refreshStatus = existsSync(statusFile)
  ? JSON.parse(readFileSync(statusFile, 'utf8'))
  : { lastRefresh: null, running: false, lastError: null };

function saveStatus() { writeFileSync(statusFile, JSON.stringify(refreshStatus, null, 2)); }

// ── coleta completa de dados (páginas + Instagram) ────────────────────────────
async function runFullRefresh() {
  if (refreshStatus.running) return { ok: false, msg: 'Já está atualizando…' };
  refreshStatus.running = true;
  refreshStatus.lastError = null;
  saveStatus();
  console.log('[REFRESH] Iniciando coleta completa…', new Date().toLocaleString('pt-BR'));

  try {
    const get = async (url) => { try { const r = await fetch(url); return r.json(); } catch (e) { return { error: e.message }; } };
    const getAll = async (url) => {
      const items = []; let next = url; let p = 0;
      while (next && p < 15) { const r = await get(next); if (r.error || !r.data) break; items.push(...r.data); next = r.paging?.next || null; p++; }
      return items;
    };

    const pages = (await get(`${BASE}/me/accounts?fields=id,name,access_token,fan_count,followers_count,instagram_business_account&limit=50&access_token=${META_TOKEN}`)).data || [];
    const pagesData = [];

    for (const page of pages) {
      const igId = page.instagram_business_account?.id;
      let igData = null;
      if (igId) {
        igData = await get(`${BASE}/${igId}?fields=id,username,name,followers_count,follows_count,media_count,biography,website&access_token=${page.access_token}`);
        if (!igData.error) {
          const igIns = await get(`${BASE}/${igId}/insights?metric=impressions,reach,profile_views,follower_count,website_clicks&period=month&access_token=${page.access_token}`);
          const igMedia = await getAll(`${BASE}/${igId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=50&access_token=${page.access_token}`);
          igData.insights_month = igIns.data || [];
          igData.media = igMedia;
        } else { igData = null; }
      }
      const posts = await getAll(`${BASE}/${page.id}/posts?fields=id,message,story,created_time,full_picture&limit=100&access_token=${page.access_token}`);
      pagesData.push({
        id: page.id, name: page.name,
        fan_count: page.fan_count || 0, followers_count: page.followers_count || 0,
        instagram: igData,
        posts: posts.map(p => ({ id: p.id, message: (p.message || p.story || '').slice(0, 400), created_time: p.created_time, has_image: !!p.full_picture })),
      });
    }

    const existing = existsSync(rawFile) ? JSON.parse(readFileSync(rawFile, 'utf8')) : {};
    const updated = { ...existing, pages: pagesData, timestamp: new Date().toISOString() };
    writeFileSync(rawFile, JSON.stringify(updated, null, 2));

    refreshStatus.lastRefresh = new Date().toISOString();
    refreshStatus.running = false;
    refreshStatus.lastError = null;
    saveStatus();
    console.log('[REFRESH] Concluído!', new Date().toLocaleString('pt-BR'));

    // Gerar recomendações com IA em background (falha não afeta o refresh)
    generateRecommendations().catch(e => console.error('[RECS] Falhou em background:', e.message));

    return { ok: true, timestamp: refreshStatus.lastRefresh };
  } catch (e) {
    refreshStatus.running = false;
    refreshStatus.lastError = e.message;
    saveStatus();
    console.error('[REFRESH] Erro:', e.message);
    return { ok: false, msg: e.message };
  }
}

// ── agendador diário: toda madrugada às 03:00 ─────────────────────────────────
function agendarProximoRefresh() {
  const agora = new Date();
  const proximas3h = new Date(agora);
  proximas3h.setHours(3, 0, 0, 0);
  if (proximas3h <= agora) proximas3h.setDate(proximas3h.getDate() + 1);
  const ms = proximas3h - agora;
  console.log(`[REFRESH] Próxima atualização automática: ${proximas3h.toLocaleString('pt-BR')} (em ${Math.round(ms/60000)} min)`);
  setTimeout(async () => {
    await runFullRefresh();
    agendarProximoRefresh(); // reagendar para o próximo dia
  }, ms);
}

agendarProximoRefresh();

app.use(express.json());
app.use(express.static(__dirname));

app.get('/meta-dashboard', (req, res) => res.redirect('/meta-dashboard.html'));
app.get('/vendas', (req, res) => res.redirect('/vendas.html'));

const BASE = 'https://graph.facebook.com/v21.0';
const ACC_ID = process.env.ACC_ID || '226773313101799';
const metaGet = async (url) => { try { const r = await fetch(url); return r.json(); } catch (e) { return { error: e.message }; } };

const INSIGHT_FIELDS = [
  'campaign_id','campaign_name','spend','impressions','reach','clicks','unique_clicks',
  'ctr','unique_ctr','cpc','cpm','cpp','frequency',
  'actions','cost_per_action_type','purchase_roas','outbound_clicks',
  'date_start','date_stop'
].join(',');

// ── GET /api/insights ─────────────────────────────────────────────────────────
// ?preset=maximum|today|last_7d|this_month|last_30d|last_90d|last_year
// ?since=YYYY-MM-DD&until=YYYY-MM-DD  (período personalizado)
app.get('/api/insights', async (req, res) => {
  try {
    const { preset, since, until, accountId } = req.query;
    // Aceitar qualquer conta numérica válida; fallback para conta principal
    const actId = /^\d+$/.test(accountId || '') ? accountId : ACC_ID;

    let dateParam;
    if (since && until) {
      dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;
    } else {
      dateParam = `date_preset=${preset || 'maximum'}`;
    }

    const [campIns, acctIns, trendIns] = await Promise.all([
      metaGet(`${BASE}/act_${actId}/insights?fields=${INSIGHT_FIELDS}&${dateParam}&level=campaign&limit=200&access_token=${META_TOKEN}`),
      metaGet(`${BASE}/act_${actId}/insights?fields=${INSIGHT_FIELDS}&${dateParam}&level=account&access_token=${META_TOKEN}`),
      metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,date_start,date_stop&${dateParam}&level=account&time_increment=1&access_token=${META_TOKEN}`),
    ]);

    // Surface Meta API errors clearly instead of silently returning empty data
    const metaError = campIns.error || acctIns.error || trendIns.error;
    if (metaError) {
      const msg = metaError.message || JSON.stringify(metaError);
      return res.status(400).json({ error: msg });
    }

    res.json({
      period: since && until ? { since, until } : { preset: preset || 'maximum' },
      accountId: actId,
      campaigns: campIns.data || [],
      account:   acctIns.data?.[0] || {},
      daily:     trendIns.data || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/data ─────────────────────────────────────────────────────────────
app.get('/api/data', (req, res) => {
  try {
    const raw = JSON.parse(readFileSync(rawFile, 'utf8'));
    res.json(raw);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── GET /api/sales ────────────────────────────────────────────────────────────
app.get('/api/sales', (req, res) => {
  const sales = existsSync(salesFile) ? JSON.parse(readFileSync(salesFile, 'utf8')) : [];
  res.json(sales);
});

// ── POST /api/sale ────────────────────────────────────────────────────────────
// Registra uma venda e envia Purchase para a Meta via CAPI
app.post('/api/sale', async (req, res) => {
  const { customer_name, customer_phone, customer_email, product, value, currency = 'BRL', notes } = req.body;

  if (!value || !product) {
    return res.status(400).json({ ok: false, error: 'Valor e produto são obrigatórios' });
  }

  const eventId = 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const eventTime = Math.floor(Date.now() / 1000);

  // Normalizar telefone → formato E.164 sem +
  const phoneNorm = customer_phone
    ? customer_phone.replace(/\D/g, '').replace(/^0/, '55')
    : undefined;

  // Montar payload CAPI
  const capiPayload = {
    data: [{
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: eventId,
      action_source: 'system_generated', // venda confirmada pelo sistema
      user_data: {
        ph: phoneNorm ? [hash(phoneNorm)] : undefined,
        em: customer_email ? [hash(customer_email)] : undefined,
        client_user_agent: 'Meta-CAPI-WhatsApp/1.0',
      },
      custom_data: {
        value: parseFloat(value),
        currency,
        content_name: product,
        content_type: 'product',
        order_id: eventId,
      },
    }],
    test_event_code: undefined, // remover em produção após testar
  };

  // Remover campos undefined
  const clean = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? undefined : v));
  const cleanPayload = clean(capiPayload);

  let capiResult = null;
  let capiError = null;

  try {
    const capiResp = await fetch(`${CAPI_URL}?access_token=${META_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    });
    capiResult = await capiResp.json();
  } catch (e) {
    capiError = e.message;
  }

  // Salvar no log local
  const sale = {
    id: eventId,
    timestamp: new Date().toISOString(),
    customer_name: customer_name || 'Não informado',
    customer_phone: customer_phone || null,
    product,
    value: parseFloat(value),
    currency,
    notes: notes || null,
    capi_sent: !capiError,
    capi_result: capiResult,
    capi_error: capiError,
  };

  const sales = existsSync(salesFile) ? JSON.parse(readFileSync(salesFile, 'utf8')) : [];
  sales.unshift(sale);
  writeFileSync(salesFile, JSON.stringify(sales, null, 2));

  const success = capiResult?.events_received === 1;
  res.json({
    ok: success || !capiError,
    sale_id: eventId,
    capi_received: capiResult?.events_received,
    capi_fbtrace: capiResult?.fbtrace_id,
    error: capiError || (success ? null : JSON.stringify(capiResult?.error || capiResult)),
  });
});

// ── POST /api/sale/test ───────────────────────────────────────────────────────
// Envia evento de teste para verificar conexão com CAPI
app.post('/api/sale/test', async (req, res) => {
  try {
    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: 'test_' + Date.now(),
        action_source: 'system_generated',
        user_data: {
          external_id: [hash('teste-capi-essence')],
          client_user_agent: 'Meta-CAPI-Test/1.0',
        },
        custom_data: { value: 1.00, currency: 'BRL', content_name: 'Teste CAPI' },
      }],
    };
    const r = await fetch(`${CAPI_URL}?access_token=${META_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await r.json();
    res.json({ ok: result.events_received === 1, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Recomendações com IA (Claude Haiku) ──────────────────────────────────────
async function generateRecommendations() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[RECS] ANTHROPIC_API_KEY não encontrada — pulando IA.');
    return { ok: false, msg: 'ANTHROPIC_API_KEY não configurada' };
  }

  console.log('[RECS] Buscando dados e gerando recomendações com IA…');
  try {
    const fields = 'campaign_name,spend,impressions,clicks,ctr,cpc,cpm,frequency,reach,actions';
    const [campResp, acctResp] = await Promise.all([
      metaGet(`${BASE}/act_${ACC_ID}/insights?fields=${fields}&date_preset=last_30d&level=campaign&limit=100&access_token=${META_TOKEN}`),
      metaGet(`${BASE}/act_${ACC_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency&date_preset=last_30d&level=account&access_token=${META_TOKEN}`),
    ]);

    if (campResp.error) throw new Error('Meta API: ' + campResp.error.message);

    const getAct = (c, type) => parseInt((c.actions || []).find(a => a.action_type === type)?.value || 0);

    const camps = (campResp.data || [])
      .filter(c => parseFloat(c.spend || 0) > 0)
      .sort((a, b) => parseFloat(b.spend || 0) - parseFloat(a.spend || 0))
      .slice(0, 12);

    const acct = acctResp.data?.[0] || {};

    // Payload compacto para minimizar tokens enviados
    const payload = {
      conta: 'Essence Atrativos 2',
      periodo: '30d',
      total: {
        gasto: +parseFloat(acct.spend || 0).toFixed(2),
        impressoes: +parseInt(acct.impressions || 0),
        cliques: +parseInt(acct.clicks || 0),
        ctr: +parseFloat(acct.ctr || 0).toFixed(2),
        cpc: +parseFloat(acct.cpc || 0).toFixed(2),
        cpm: +parseFloat(acct.cpm || 0).toFixed(2),
        freq: +parseFloat(acct.frequency || 0).toFixed(1),
        alcance: +parseInt(acct.reach || 0),
      },
      campanhas: camps.map(c => {
        const spend = parseFloat(c.spend || 0);
        const convs = getAct(c, 'onsite_conversion.messaging_conversation_started_7d');
        const replies = getAct(c, 'onsite_conversion.messaging_first_reply');
        return {
          n: c.campaign_name.slice(0, 45),
          s: +spend.toFixed(2),
          i: +parseInt(c.impressions || 0),
          ctr: +parseFloat(c.ctr || 0).toFixed(2),
          cpc: +parseFloat(c.cpc || 0).toFixed(2),
          f: +parseFloat(c.frequency || 0).toFixed(1),
          cv: convs,
          cpv: convs > 0 ? +(spend / convs).toFixed(2) : null,
          mcv: convs > 0 ? +(replies / convs).toFixed(1) : null,
        };
      }),
    };

    const prompt = `Você é especialista em Meta Ads para WhatsApp commerce brasileiro. Analise os dados e retorne APENAS um JSON válido com array "recs" de 6-8 recomendações priorizadas.

Dados (${payload.periodo}, ${payload.conta}):
${JSON.stringify(payload)}

Benchmarks: CTR bom>3%, ótimo>5%. CPC bom<R$0,30. CPM bom<R$8. Freq>3=saturação,>5=crítico. Custo/conv: ótimo<R$8, ok R$8-20, caro>R$20. Msgs/conv>0,7=bom.

Campos obrigatórios por item (exatamente estes, sem extras):
{"titulo":"max 7 palavras","prio":"CRÍTICO|ALTO|MÉDIO|BAIXO","ico":"emoji","corpo":"2-3 frases com números reais dos dados","acao":"→ instrução imperativa"}

Priorize problemas reais > oportunidades de escala > melhorias gerais. Use os números exatos dos dados. Responda APENAS com o JSON, sem markdown.`;

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${(await aiResp.text()).slice(0, 150)}`);

    const aiResult = await aiResp.json();
    const rawText = (aiResult.content?.[0]?.text || '').trim();

    // Tolerar se o modelo colocou bloco markdown
    const jsonText = rawText.startsWith('{')
      ? rawText
      : rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(jsonText);
    const recsData = {
      generated_at: new Date().toISOString(),
      period: 'last_30d',
      tokens_in: aiResult.usage?.input_tokens || 0,
      tokens_out: aiResult.usage?.output_tokens || 0,
      recs: (parsed.recs || []).slice(0, 10),
    };

    writeFileSync(recsFile, JSON.stringify(recsData, null, 2));
    console.log(`[RECS] ${recsData.recs.length} recomendações geradas. Tokens: ${recsData.tokens_in}in / ${recsData.tokens_out}out`);
    return { ok: true, count: recsData.recs.length };
  } catch (e) {
    console.error('[RECS] Erro:', e.message);
    return { ok: false, msg: e.message };
  }
}

// ── GET /api/recs ─────────────────────────────────────────────────────────────
app.get('/api/recs', (req, res) => {
  if (existsSync(recsFile)) {
    res.json(JSON.parse(readFileSync(recsFile, 'utf8')));
  } else {
    res.json({ recs: [], generated_at: null });
  }
});

// ── POST /api/recs/generate ───────────────────────────────────────────────────
app.post('/api/recs/generate', async (req, res) => {
  const result = await generateRecommendations();
  if (result.ok && existsSync(recsFile)) {
    res.json({ ...result, data: JSON.parse(readFileSync(recsFile, 'utf8')) });
  } else {
    res.status(result.msg?.includes('ANTHROPIC_API_KEY') ? 400 : 500).json(result);
  }
});

// ── GET /api/refresh/status ───────────────────────────────────────────────────
app.get('/api/refresh/status', (req, res) => {
  res.json(refreshStatus);
});

// ── POST /api/refresh ─────────────────────────────────────────────────────────
app.post('/api/refresh', async (req, res) => {
  const result = await runFullRefresh();
  res.json(result);
});

// ── AGENTES ──────────────────────────────────────────────────────────────────
const agentsFile = join(dataDir, 'agents_data.json');

const AGENT_DEFS = {
  trace: {
    name: 'Trace', role: 'Analista de Tráfego Pago',
    prompt: (data) => `Você é Trace, analista sênior de tráfego pago da Meta Ads. Analise os dados abaixo e retorne APENAS JSON válido (sem markdown):
{"messages":[{"type":"text","text":"mensagem em português simples, max 2 frases, mencione números reais"},{"type":"action","priority":"urgent|opportunity|suggestion","title":"título max 6 palavras","description":"contexto com números reais, max 2 frases","action_type":"pause_campaign|update_budget|info_only","action_payload":{"campaign_id":"id ou null","campaign_name":"nome"},"status":"pending"}]}
Foque em: frequência >3 (saturação), CTR abaixo de 1%, campanhas com ROAS<2 (pausar), campanhas com ROAS>3.5 (escalar).
Dados (últimos 7 dias): ${JSON.stringify(data)}
Gere 1-2 mensagens de texto e 1-3 ações. Use linguagem direta e didática. Responda APENAS o JSON.`,
  },
  buck: {
    name: 'Buck', role: 'Otimizador de Orçamento',
    prompt: (data) => `Você é Buck, especialista em otimização de orçamento Meta Ads. Retorne APENAS JSON:
{"messages":[{"type":"text","text":"análise de orçamento em português, max 2 frases com números reais"},{"type":"action","priority":"urgent|opportunity|suggestion","title":"título max 6 palavras","description":"justificativa com números, max 2 frases","action_type":"update_budget|pause_campaign|info_only","action_payload":{"adset_id":"id ou null","adset_name":"nome","new_budget":valor_em_centavos},"status":"pending"}]}
Foque em: redistribuir verba de campanhas ruins para boas, identificar campanhas esgotando orçamento cedo, sugerir aumentos onde ROAS>3.
Dados: ${JSON.stringify(data)}
Gere 1-2 mensagens e 1-3 ações. Responda APENAS o JSON.`,
  },
  cris: {
    name: 'Cris', role: 'Revisora de Criativos',
    prompt: (data) => `Você é Cris, especialista em criativos Meta Ads. Retorne APENAS JSON:
{"messages":[{"type":"text","text":"análise de criativos em português, max 2 frases com dados reais"},{"type":"action","priority":"urgent|opportunity|suggestion","title":"título max 6 palavras","description":"contexto com métricas, max 2 frases","action_type":"pause_campaign|info_only","action_payload":{"campaign_name":"nome"},"status":"pending"}]}
Foque em: frequência >3.5 (criativo saturado — pausar), CTR muito baixo (criativo ruim), identificar o criativo campeão (maior CTR).
Dados: ${JSON.stringify(data)}
Gere 1-2 mensagens e 1-2 ações. Responda APENAS o JSON.`,
  },
  rex: {
    name: 'Rex', role: 'Gerador de Relatórios',
    prompt: (data) => `Você é Rex, especialista em relatórios de tráfego pago. Retorne APENAS JSON com um resumo executivo claro:
{"messages":[{"type":"text","text":"parágrafo de resumo executivo, max 3 frases com números totais"},{"type":"text","text":"principais destaques positivos e negativos do período, max 3 frases"},{"type":"action","priority":"suggestion","title":"Relatório completo gerado","description":"Resumo do período com métricas consolidadas","action_type":"info_only","action_payload":{},"status":"pending"}]}
Dados: ${JSON.stringify(data)}
Seja direto e use os números reais. Responda APENAS o JSON.`,
  },
  ada: {
    name: 'Ada', role: 'Criadora de Anúncios',
    prompt: (data) => `Você é Ada, copywriter especialista em anúncios Meta Ads para WhatsApp. Retorne APENAS JSON com sugestões de copy:
{"messages":[{"type":"text","text":"análise do que está funcionando e o estilo de copy ideal, max 2 frases"},{"type":"text","text":"sugestão de texto de anúncio pronto para usar: headline + corpo + CTA"},{"type":"action","priority":"suggestion","title":"Copy A/B gerado","description":"2 variações de anúncio prontas para testar","action_type":"info_only","action_payload":{},"status":"pending"}]}
Baseie-se nos dados das campanhas que performam melhor. Dados: ${JSON.stringify(data)}
Responda APENAS o JSON.`,
  },
  cleo: {
    name: 'Cleo', role: 'Diretora de Criativos',
    prompt: (data) => `Você é Cleo, diretora de criativos especialista em vídeo para Meta Ads. Retorne APENAS JSON com um brief de vídeo:
{"messages":[{"type":"text","text":"análise do que o público está respondendo, max 2 frases com dados"},{"type":"text","text":"brief completo: gancho (0-3s), desenvolvimento (3-15s), CTA (15-30s) — seja específico e criativo"},{"type":"action","priority":"suggestion","title":"Brief de vídeo gerado","description":"Roteiro completo pronto para gravar","action_type":"info_only","action_payload":{},"status":"pending"}]}
Dados das campanhas ativas: ${JSON.stringify(data)}
Responda APENAS o JSON.`,
  },
};

function loadAgentsData() {
  if (existsSync(agentsFile)) {
    try { return JSON.parse(readFileSync(agentsFile, 'utf8')); } catch { /* fall */ }
  }
  const d = {};
  Object.keys(AGENT_DEFS).forEach(id => { d[id] = { status: 'idle', generated_at: null, messages: [] }; });
  return d;
}

function saveAgentsData(data) { writeFileSync(agentsFile, JSON.stringify(data, null, 2)); }

async function runAgentAnalysis(agentId, apiKey) {
  apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, msg: 'ANTHROPIC_API_KEY não configurada' };

  const agents = loadAgentsData();
  agents[agentId] = { ...agents[agentId], status: 'working' };
  saveAgentsData(agents);

  try {
    const campData = await metaGet(`${BASE}/act_${ACC_ID}/insights?fields=campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,purchase_roas&date_preset=last_7d&level=campaign&limit=50&access_token=${META_TOKEN}`);
    const acctData = await metaGet(`${BASE}/act_${ACC_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency&date_preset=last_7d&level=account&access_token=${META_TOKEN}`);

    const payload = {
      account: acctData.data?.[0] || {},
      campaigns: (campData.data || []).filter(c => parseFloat(c.spend || 0) > 0).slice(0, 10),
    };

    const def = AGENT_DEFS[agentId];
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: def.prompt(payload) }] }),
    });

    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}`);
    const aiResult = await aiResp.json();
    let rawText = (aiResult.content?.[0]?.text || '').trim();
    if (!rawText.startsWith('{')) rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(rawText);

    agents[agentId] = { status: 'ready', generated_at: new Date().toISOString(), messages: parsed.messages || [] };
    saveAgentsData(agents);
    return { ok: true };
  } catch (e) {
    agents[agentId] = { status: 'idle', generated_at: null, messages: [] };
    saveAgentsData(agents);
    return { ok: false, msg: e.message };
  }
}

async function runAutoAgents() {
  console.log('[AGENTS] Iniciando análise automática…', new Date().toLocaleString('pt-BR'));
  for (const id of ['trace', 'buck', 'cris']) {
    await runAgentAnalysis(id);
    console.log(`[AGENTS] ${id} concluído`);
  }
}

function agendarAnaliseAgentes() {
  const agora = new Date();
  const prox = new Date(agora);
  prox.setHours(8, 0, 0, 0);
  if (prox <= agora) prox.setDate(prox.getDate() + 1);
  const ms = prox - agora;
  console.log(`[AGENTS] Próxima análise automática: ${prox.toLocaleString('pt-BR')}`);
  setTimeout(async () => { await runAutoAgents(); agendarAnaliseAgentes(); }, ms);
}

agendarAnaliseAgentes();

// ── GET /api/agents/status ────────────────────────────────────────────────────
app.get('/api/agents/status', (req, res) => res.json(loadAgentsData()));

// ── POST /api/agents/:id/analyze ─────────────────────────────────────────────
app.post('/api/agents/:id/analyze', async (req, res) => {
  const { id } = req.params;
  if (!AGENT_DEFS[id]) return res.status(404).json({ error: 'Agente não encontrado' });
  const apiKey = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  const result = await runAgentAnalysis(id, apiKey);
  if (!result.ok) return res.status(500).json({ error: result.msg });
  res.json(loadAgentsData());
});

// ── POST /api/agents/:id/action ───────────────────────────────────────────────
app.post('/api/agents/:id/action', async (req, res) => {
  const { id } = req.params;
  const { message_index, confirmed } = req.body;
  const agents = loadAgentsData();
  const agent = agents[id];
  if (!agent || !agent.messages[message_index]) return res.status(404).json({ error: 'Ação não encontrada' });

  const msg = agent.messages[message_index];
  if (confirmed) {
    try {
      const p = msg.action_payload || {};
      if (msg.action_type === 'pause_campaign' && p.campaign_id) {
        await fetch(`${BASE}/${p.campaign_id}?status=PAUSED&access_token=${META_TOKEN}`, { method: 'POST' });
      } else if (msg.action_type === 'update_budget' && p.adset_id && p.new_budget) {
        await fetch(`${BASE}/${p.adset_id}?daily_budget=${p.new_budget}&access_token=${META_TOKEN}`, { method: 'POST' });
      }
      msg.status = 'executed';
    } catch (e) {
      return res.status(500).json({ error: 'Falha ao executar na Meta API: ' + e.message });
    }
  } else {
    msg.status = 'skipped';
  }

  saveAgentsData(agents);
  res.json(agents);
});

// ── GET /agentes ──────────────────────────────────────────────────────────────
app.get('/agentes', (req, res) => res.redirect('/agentes.html'));

// Localmente sobe o servidor normalmente; no Vercel exporta o app como handler
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n✅ Dashboard:      http://localhost:${PORT}/meta-dashboard.html`);
    console.log(`✅ Agentes:        http://localhost:${PORT}/agentes.html`);
    console.log(`✅ Registrar venda: http://localhost:${PORT}/vendas.html\n`);
  });
}

export default app;
