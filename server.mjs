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
const memoryFile = join(dataDir, 'agents_memory.json');

// ── SISTEMA DE MEMÓRIA (180 dias) ─────────────────────────────────────────────
function loadMemory() {
  if (existsSync(memoryFile)) {
    try { return JSON.parse(readFileSync(memoryFile, 'utf8')); } catch { /* fall */ }
  }
  return { analyses: [], decisions: [], champions: [] };
}

function saveMemory(mem) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const cut = (arr) => arr.filter(e => new Date(e.ts) >= cutoff);
  mem.analyses  = cut(mem.analyses).slice(-500);
  mem.decisions = cut(mem.decisions).slice(-1000);
  mem.champions = cut(mem.champions).slice(-50);
  writeFileSync(memoryFile, JSON.stringify(mem, null, 2));
}

function getDecisionHistory(accountId, days = 30) {
  const mem = loadMemory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return mem.decisions
    .filter(d => d.account === accountId && new Date(d.ts) >= cutoff)
    .slice(-20);
}

function getPreviousAnalyses(agentId, accountId, count = 5) {
  const mem = loadMemory();
  return mem.analyses
    .filter(a => a.agent === agentId && a.account === accountId)
    .slice(-count);
}

function buildPrevPeriodParam(periodLabel, since, until) {
  // se tem since/until customizado:
  if (since && until) {
    const s = new Date(since), u = new Date(until);
    const days = Math.round((u - s) / 86400000) + 1;
    const ps = new Date(s); ps.setDate(ps.getDate() - days);
    const pu = new Date(u); pu.setDate(pu.getDate() - days);
    return `time_range=${encodeURIComponent(JSON.stringify({ since: ps.toISOString().slice(0,10), until: pu.toISOString().slice(0,10) }))}`;
  }
  // presets comuns
  const daysMap = { last_7d:7, last_14d:14, last_30d:30, last_90d:90, today:1, yesterday:1, this_month:null };
  if (periodLabel === 'this_month') return 'date_preset=last_month';
  const days = daysMap[periodLabel] || 7;
  const pu = new Date(); pu.setDate(pu.getDate() - days - 1);
  const ps = new Date(pu); ps.setDate(ps.getDate() - days + 1);
  return `time_range=${encodeURIComponent(JSON.stringify({ since: ps.toISOString().slice(0,10), until: pu.toISOString().slice(0,10) }))}`;
}

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
app.use(express.static(__dirname, {
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

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
    const actId = /^\d+$/.test(accountId || '') ? accountId : ACC_ID;
    const token = req.headers['x-meta-token'] || META_TOKEN;

    if (!token) return res.status(400).json({ error: 'META_TOKEN não configurado. Configure o token na aba ⚙️ Configurações.' });

    let dateParam;
    if (since && until) {
      dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;
    } else {
      dateParam = `date_preset=${preset || 'maximum'}`;
    }

    const [campIns, acctIns, trendIns, acctInfo] = await Promise.all([
      metaGet(`${BASE}/act_${actId}/insights?fields=${INSIGHT_FIELDS}&${dateParam}&level=campaign&limit=200&access_token=${token}`),
      metaGet(`${BASE}/act_${actId}/insights?fields=${INSIGHT_FIELDS}&${dateParam}&level=account&access_token=${token}`),
      metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,date_start,date_stop&${dateParam}&level=account&time_increment=1&access_token=${token}`),
      metaGet(`${BASE}/act_${actId}?fields=currency&access_token=${token}`),
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
      currency: acctInfo.currency || 'BRL',
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
async function generateRecommendations(accountId, metaToken) {
  const actId = /^\d+$/.test(accountId || '') ? accountId : ACC_ID;
  const token = metaToken || META_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[RECS] ANTHROPIC_API_KEY não encontrada — pulando IA.');
    return { ok: false, msg: 'ANTHROPIC_API_KEY não configurada' };
  }

  console.log('[RECS] Buscando dados e gerando recomendações com IA…');
  try {
    const fields = 'campaign_name,spend,impressions,clicks,ctr,cpc,cpm,frequency,reach,actions';
    const [campResp, acctResp] = await Promise.all([
      metaGet(`${BASE}/act_${actId}/insights?fields=${fields}&date_preset=last_30d&level=campaign&limit=100&access_token=${token}`),
      metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency&date_preset=last_30d&level=account&access_token=${token}`),
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
        model: 'claude-haiku-4-5',
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
  const accountId  = req.headers['x-acc-id']     || req.body?.accountId;
  const metaToken  = req.headers['x-meta-token'] || META_TOKEN;
  const result = await generateRecommendations(accountId, metaToken);
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
    prompt: (data, period) => `Você é Trace, analista sênior de tráfego pago da Meta Ads para a conta "Essence Atrativos". Analise APENAS as campanhas ATIVAS abaixo e retorne APENAS JSON válido:
{"messages":[{"type":"text","text":"resumo em 2 frases com números reais do período"},{"type":"action","priority":"urgent|opportunity|suggestion","title":"título max 6 palavras","description":"contexto com números reais, max 2 frases","action_type":"pause_campaign|update_budget|info_only","action_payload":{"campaign_id":"id real da campanha","campaign_name":"nome","increase_pct":20},"status":"pending"}]}

REGRAS CRÍTICAS — siga sempre:
1. Campanhas em APRENDIZADO (gastos < R$150 no período OU criadas há menos de 7 dias): NÃO recomende pausar. Informe que estão aprendendo e precisam de mais tempo e dados
2. Campanhas com BOM DESEMPENHO (ROAS>3 OU CTR>3% OU conversas/gasto baixo): diga EXPLICITAMENTE para NÃO mexer. "Campanha performando bem — mantenha como está"
3. Campanhas SATURADAS (frequência>3): recomende novo criativo, NÃO pausar se ROAS for bom
4. Pausar apenas: ROAS<1.5 E frequência>2 E gasto>R$80 E não está em aprendizado
5. Escalar: ROAS>3.5 E frequência<2.5 — sugira increase_pct:20

IMPORTANTE: No action_payload do update_budget, inclua "campaign_id" com o ID real da campanha dos dados e "increase_pct" com o percentual inteiro (ex: 20 para +20%). NUNCA inclua "new_budget" — o servidor calcula o valor real.

${data.account_prev && data.account_prev.spend ? `COMPARAÇÃO COM PERÍODO ANTERIOR:
Período atual vs anterior — variações: gasto atual R$${parseFloat(data.account?.spend||0).toFixed(2)} vs R$${parseFloat(data.account_prev?.spend||0).toFixed(2)}, CTR ${parseFloat(data.account?.ctr||0).toFixed(2)}% vs ${parseFloat(data.account_prev?.ctr||0).toFixed(2)}%, CPC R$${parseFloat(data.account?.cpc||0).toFixed(2)} vs R$${parseFloat(data.account_prev?.cpc||0).toFixed(2)}.
Se alguma métrica variou > 30% entre períodos, isso é uma anomalia a destacar com URGÊNCIA.` : ''}

${data.daily_trend && data.daily_trend.length >= 2 ? `ALERTAS DE ANOMALIA (últimos ${data.daily_trend.length} dias):
${(() => {
  const days = data.daily_trend;
  const lastDay = days[days.length - 1];
  const prevDays = days.slice(0, -1);
  const avgCPC = prevDays.reduce((s, d) => s + parseFloat(d.cpc||0), 0) / (prevDays.length || 1);
  const avgCTR = prevDays.reduce((s, d) => s + parseFloat(d.ctr||0), 0) / (prevDays.length || 1);
  const alerts = [];
  if (parseFloat(lastDay.cpc||0) > avgCPC * 2) alerts.push('CPC do último dia (' + parseFloat(lastDay.cpc).toFixed(2) + ') está acima do dobro da média (' + avgCPC.toFixed(2) + ') — URGENTE');
  if (parseFloat(lastDay.ctr||0) < avgCTR * 0.6) alerts.push('CTR do último dia (' + parseFloat(lastDay.ctr).toFixed(2) + '%) está abaixo de 60% da média (' + avgCTR.toFixed(2) + '%) — URGENTE');
  if (parseFloat(lastDay.spend||0) === 0) alerts.push('Gasto do último dia = R$0 — campanha pode ter parado');
  return alerts.length ? alerts.join('\\n') : 'Nenhuma anomalia detectada nos últimos dias.';
})()}` : ''}

${data.decision_history && data.decision_history.length > 0 ? `HISTÓRICO DE DECISÕES (últimos 45 dias):
${JSON.stringify(data.decision_history.slice(-5))}
Para cada decisão executada, verifique se as métricas atuais melhoraram ou pioraram em relação ao período da decisão.` : ''}

Período analisado: ${period}
Dados (somente campanhas ativas com gasto no período): ${JSON.stringify(data)}
Gere 1-2 textos e 1-3 ações. Responda APENAS o JSON.`,
  },
  buck: {
    name: 'Buck', role: 'Otimizador de Orçamento',
    prompt: (data, period) => `Você é Buck, especialista em otimização de orçamento Meta Ads para "Essence Atrativos". Retorne APENAS JSON:
{"messages":[{"type":"text","text":"análise de distribuição de orçamento em 2 frases com R$ reais"},{"type":"action","priority":"urgent|opportunity|suggestion","title":"título max 6 palavras","description":"justificativa com números, max 2 frases","action_type":"update_budget|pause_campaign|info_only","action_payload":{"campaign_id":"id real da campanha","campaign_name":"nome","increase_pct":20},"status":"pending"}]}

REGRAS:
1. Campanhas em aprendizado (gasto < R$150 no período): NÃO mexa no orçamento — deixe estabilizar
2. Campanhas com ROAS>3: sugira aumentar orçamento 20-30% (use increase_pct:20 ou increase_pct:30)
3. Campanhas com ROAS<1.5 e gasto>R$80: sugira reduzir orçamento (use increase_pct:-20) ou pausar
4. Redistribua verba de campanhas ruins para as que estão convertendo
5. Nunca sugira cortar verba de campanha que está gerando conversas/leads a bom custo
IMPORTANTE: No action_payload use "campaign_id" com o ID real e "increase_pct" como número inteiro (positivo para aumentar, negativo para reduzir). NUNCA use "new_budget".

REDISTRIBUIÇÃO: quando sugerir reduzir ou pausar uma campanha ruim, SEMPRE gere também uma segunda ação de update_budget para a melhor campanha (increase_pct positivo) para aproveitar o orçamento liberado.

${data.month_spend_info && data.month_spend_info.mtd_spend !== undefined ? `RITMO DE GASTO MENSAL:
- Dias passados no mês: ${data.month_spend_info.days_passed}/${data.month_spend_info.days_in_month}
- Gasto MTD: R$${parseFloat(data.month_spend_info.mtd_spend).toFixed(2)}
- Taxa diária média: R$${data.month_spend_info.daily_rate}/dia
- Projeção para fim do mês: R$${data.month_spend_info.projected_spend}
Se a projeção indicar extrapolação do orçamento esperado: marque como URGENTE. Se vai sobrar muito: sugira aumentar orçamento das campanhas melhores.
META REVERSA: com base no custo por conversa atual, calcule quanto orçamento seria necessário para atingir 300, 500 e 1000 conversas no mês.` : ''}

Período: ${period}. Dados: ${JSON.stringify(data)}
Gere 1-2 textos e 1-3 ações. Responda APENAS o JSON.`,
  },
  cris: {
    name: 'Cris', role: 'Revisora de Criativos',
    prompt: (data, period) => `Você é Cris, especialista em criativos Meta Ads para "Essence Atrativos". Retorne APENAS JSON:
{"messages":[{"type":"text","text":"análise de desempenho dos criativos em 2 frases com CTR e frequência reais"},{"type":"action","priority":"urgent|opportunity|suggestion","title":"título max 6 palavras","description":"contexto com métricas, max 2 frases","action_type":"pause_campaign|info_only","action_payload":{"campaign_name":"nome"},"status":"pending"}]}

COMO IDENTIFICAR O CAMPEÃO (siga esta ordem):
1. Descarte campanhas com gasto < R$15 no período
2. Entre as que restam, calcule: score = conversas_iniciadas / spend
3. Se nenhuma tiver conversas, use: maior CTR entre campanhas com gasto > R$15
4. EMPATE: desempata por menor CPC

REGRAS:
1. Criativo CAMPEÃO: destaque, explique por que vence com números reais, diga para manter e replicar o estilo
2. Frequência>3.5: criativo saturado — sugira novo criativo, não necessariamente pausar
3. CTR<0.8%: criativo fraco — sugira revisar imagem e texto
4. Campanhas em aprendizado (gasto baixo): não critique o CTR ainda

${data.champions_library && data.champions_library.length > 0 ? `BIBLIOTECA DE CAMPEÕES ANTERIORES (use para comparação):
${JSON.stringify(data.champions_library.map(c => ({ name: c.campaign_name, ctr: c.ctr, cpc: c.cpc, spend: c.spend, ts: c.ts })))}
Compare o desempenho atual com os campeões históricos para identificar tendências.` : ''}

${data.placement_breakdown && data.placement_breakdown.length > 0 ? `ANÁLISE DE PLACEMENT (dados disponíveis):
Identifique se Feed vs Reels vs Stories apresenta desempenho significativamente diferente nos dados acima.
Se um placement tiver CTR > 2x outro, destaque isso como oportunidade de otimização.` : ''}

Período: ${period}. Dados (campanhas + criativos reais quando disponíveis): ${JSON.stringify(data)}
Gere 2 textos e 1-2 ações. Responda APENAS o JSON.`,
  },
  rex: {
    name: 'Rex', role: 'Gerador de Relatórios',
    prompt: (data, period) => `Você é Rex, especialista em relatórios executivos de tráfego pago para "Essence Atrativos". Retorne APENAS JSON:
{"messages":[
  {"type":"text","text":"RESUMO EXECUTIVO (3 frases): total gasto, total de conversas/leads, custo médio por conversa, comparação com período anterior se disponível"},
  {"type":"text","text":"DESTAQUES POSITIVOS: 2-3 campanhas que performaram bem com números reais"},
  {"type":"text","text":"PONTOS DE ATENÇÃO: 2-3 campanhas ou métricas que precisam de ação com números reais"},
  {"type":"text","text":"RECOMENDAÇÃO GERAL: 1-2 ações prioritárias para o próximo período. Compare período atual vs anterior: gasto atual R$${parseFloat(data.account?.spend||0).toFixed(2)} vs anterior R$${parseFloat(data.account_prev?.spend||0).toFixed(2)}, CTR atual ${parseFloat(data.account?.ctr||0).toFixed(2)}% vs anterior ${parseFloat(data.account_prev?.ctr||0).toFixed(2)}%"},
  {"type":"action","priority":"suggestion","title":"📊 Relatório ${period} gerado","description":"Clique em Baixar para exportar o relatório completo com gráficos","action_type":"download_report","action_payload":{"period":"${period}","total_spend":"${data.account?.spend || 0}","total_campaigns":${(data.campaigns||[]).length}},"status":"pending"}
]}
Período: ${period}. Dados completos (incluindo daily_data para gráficos e account_prev para comparação): ${JSON.stringify(data)}
Use números reais. Seja direto e executivo. Responda APENAS o JSON.`,
  },
  ada: {
    name: 'Ada', role: 'Criadora de Anúncios',
    prompt: (data, period) => `Você é Ada, especialista em copy para Meta Ads, trabalhando para "Essence Atrativos".

MUITO IMPORTANTE: Analise os nomes REAIS das campanhas abaixo para entender os produtos/serviços anunciados. Crie copies BASEADAS nos produtos reais. NÃO invente produtos que não existam nos dados.

CRITÉRIO PARA ESCOLHER A BASE:
- Use a campanha com MELHOR custo por conversa (menor spend/conversas) com gasto > R$15
- Se não tiver conversas: use a de maior CTR com gasto > R$15

Retorne APENAS JSON:
{"messages":[
  {"type":"text","text":"ANÁLISE (1 texto): qual campanha serviu de base, qual ângulo está funcionando e por quê — 2-3 frases com números reais"},
  {"type":"text","text":"✍️ 5 VARIAÇÕES DE HEADLINE para o produto da campanha campeã:\\nHeadline 1 (benefício direto): [headline]\\nHeadline 2 (curiosidade/pergunta): [headline]\\nHeadline 3 (prova social): [headline]\\nHeadline 4 (urgência/oferta): [headline]\\nHeadline 5 (dor/problema): [headline]"},
  {"type":"text","text":"✍️ COPY SEGMENTO A — Mulheres 25-35 (tom: moderno, prático, resultado rápido)\\n\\nHeadline: [headline para esse segmento]\\nTexto: [copy completa 3-4 frases, linguagem moderna e direta]\\nCTA: Chame no WhatsApp"},
  {"type":"action","priority":"opportunity","title":"Criar campanha Segmento A","description":"Campanha pausada para Mulheres 25-35 pronta para adicionar criativo","action_type":"create_campaign","action_payload":{"campaign_name":"[produto real] — Segmento A 25-35","objective":"OUTCOME_LEADS","daily_budget_brl":30,"copy_headline":"[headline segmento A]","copy_body":"[texto segmento A completo]","cta_type":"SEND_MESSAGE","base_campaign_id":"[id da campanha com melhor ROAS ou CTR]"},"status":"pending"},
  {"type":"text","text":"✍️ COPY SEGMENTO B — Mulheres 35-55 (tom: confiança, experiência, qualidade)\\n\\nHeadline: [headline para esse segmento]\\nTexto: [copy completa 3-4 frases, linguagem que transmite autoridade e confiança]\\nCTA: Chame no WhatsApp"},
  {"type":"action","priority":"suggestion","title":"Criar campanha Segmento B","description":"Campanha pausada para Mulheres 35-55 — teste de segmento etário","action_type":"create_campaign","action_payload":{"campaign_name":"[produto real] — Segmento B 35-55","objective":"OUTCOME_LEADS","daily_budget_brl":30,"copy_headline":"[headline segmento B]","copy_body":"[texto segmento B completo]","cta_type":"SEND_MESSAGE","base_campaign_id":"[mesmo id]"},"status":"pending"}
]}
Período: ${period}. Dados reais das campanhas ativas (incluindo criativos quando disponíveis): ${JSON.stringify(data)}
Responda APENAS o JSON. NÃO use placeholders — escreva tudo completo e pronto para publicar.`,
  },
  cleo: {
    name: 'Cleo', role: 'Diretora de Criativos',
    prompt: (data, period) => `Você é Cleo, diretora de criativos para Meta Ads, trabalhando para "Essence Atrativos".

MUITO IMPORTANTE: Analise os nomes REAIS das campanhas para identificar os produtos anunciados. Crie briefs de vídeo BASEADOS nesses produtos reais. NÃO invente produtos.

Use a campanha com melhor custo por conversa (ou maior CTR se não tiver conversas, gasto > R$15) como referência.

Para cada brief, gere 3 versões com timecodes no formato CapCut (HH:MM:SS:FF — 24fps):
BUMPER (7s): [00:00:00:00] → [00:00:07:00]
REELS (15s): [00:00:00:00] → [00:00:15:00]
FEED (30s): [00:00:00:00] → [00:00:30:00]

Cada cena: [timecode entrada] [timecode saída] | TELA: ... | FALA: "..."

Retorne APENAS JSON:
{"messages":[
  {"type":"text","text":"análise: quais produtos aparecem nas campanhas, qual público está respondendo melhor (CTR e conversas), qual formato/tom funciona — 2-3 frases"},
  {"type":"text","text":"🎬 BRIEF 1 — [produto/campanha base] (formato direto)\\n\\n🎯 Público: [segmento]\\n\\n📱 BUMPER (7s):\\n[00:00:00:00] [00:00:03:00] | TELA: [gancho visual] | FALA: \\"[frase de impacto]\\"\\n[00:00:03:00] [00:00:06:00] | TELA: [produto/benefício] | FALA: \\"[benefício]\\"\\n[00:00:06:00] [00:00:07:00] | TELA: [CTA] | FALA: \\"[chamada]\\"\\n\\n📱 REELS (15s):\\n[00:00:00:00] [00:00:03:00] | TELA: [gancho] | FALA: \\"[abertura forte]\\"\\n[00:00:03:00] [00:00:12:00] | TELA: [desenvolvimento] | FALA: \\"[script completo]\\"\\n[00:00:12:00] [00:00:15:00] | TELA: [CTA] | FALA: \\"[chamada WhatsApp]\\"\\n\\n📱 FEED (30s):\\n[00:00:00:00] [00:00:05:00] | TELA: [gancho] | FALA: \\"[abertura]\\"\\n[00:00:05:00] [00:00:23:00] | TELA: [desenvolvimento completo] | FALA: \\"[script detalhado]\\"\\n[00:00:23:00] [00:00:30:00] | TELA: [CTA] | FALA: \\"[chamada para ação]\\"\\n\\n🎬 Dicas: [luz, câmera, legenda, ritmo]"},
  {"type":"text","text":"🎬 BRIEF 2 — [produto] (formato depoimento/demonstração)\\n\\n🎯 Público: [segmento] \\n\\n📱 BUMPER (7s):\\n[00:00:00:00] [00:00:07:00] | TELA: [cena única impactante] | FALA: \\"[frase direta]\\"\\n\\n📱 REELS (15s):\\n[00:00:00:00] [00:00:04:00] | TELA: [abertura depoimento] | FALA: \\"[abertura]\\"\\n[00:00:04:00] [00:00:12:00] | TELA: [depoimento/demo] | FALA: \\"[script alternativo]\\"\\n[00:00:12:00] [00:00:15:00] | TELA: [CTA] | FALA: \\"[chamada]\\"\\n\\n📱 FEED (30s):\\n[roteiro completo 30s]\\n\\n🎬 Dicas: [instruções específicas para este formato]"},
  {"type":"action","priority":"suggestion","title":"Briefs de vídeo prontos","description":"2 briefs com 3 durações (7s/15s/30s) e timecodes CapCut — prontos para gravar","action_type":"info_only","action_payload":{},"status":"pending"}
]}
Período: ${period}. Dados das campanhas ativas (incluindo criativos quando disponíveis): ${JSON.stringify(data)}
Responda APENAS o JSON. Escreva os roteiros completos, palavra por palavra, prontos para gravar.`,
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

async function runAgentAnalysis(agentId, apiKey, period, accountId, metaToken) {
  apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, msg: 'ANTHROPIC_API_KEY não configurada' };
  const actId = /^\d+$/.test(accountId || '') ? accountId : ACC_ID;
  const token = metaToken || META_TOKEN;

  // Montar parâmetro de data
  const periodLabel = period || 'last_7d';
  let dateParam;
  let since_var = null, until_var = null;
  if (period && period.includes('|')) {
    [since_var, until_var] = period.split('|');
    dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since: since_var, until: until_var }))}`;
  } else {
    dateParam = `date_preset=${periodLabel}`;
  }

  const agents = loadAgentsData();
  agents[agentId] = { ...agents[agentId], status: 'working' };
  saveAgentsData(agents);

  try {
    const fields = 'campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,purchase_roas,date_start,date_stop';
    const [campData, acctData] = await Promise.all([
      metaGet(`${BASE}/act_${actId}/insights?fields=${fields}&${dateParam}&level=campaign&limit=100&access_token=${token}`),
      metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency&${dateParam}&level=account&access_token=${token}`),
    ]);

    // Campanhas que tiveram entrega no período (spend > 0 = estavam ativas)
    const activeCampaigns = (campData.data || [])
      .filter(c => parseFloat(c.spend || 0) > 0)
      .sort((a, b) => parseFloat(b.spend || 0) - parseFloat(a.spend || 0))
      .slice(0, 12);

    // Para Cris, Ada e Cleo: buscar criativos reais dos anúncios top 4
    let adsCreativeData = [];
    if (['cris', 'ada', 'cleo'].includes(agentId)) {
      const topCamps = activeCampaigns.slice(0, 4);
      for (const camp of topCamps) {
        const adsResp = await metaGet(
          `${BASE}/${camp.campaign_id}/ads?fields=id,name,status,creative{title,body,call_to_action_type}&limit=5&access_token=${token}`
        );
        if (adsResp.data?.length) {
          adsCreativeData.push({
            campaign_id:   camp.campaign_id,
            campaign_name: camp.campaign_name,
            ctr:           camp.ctr,
            cpc:           camp.cpc,
            spend:         camp.spend,
            ads: adsResp.data.map(ad => ({
              name:  ad.name,
              title: ad.creative?.title || '',
              body:  ad.creative?.body  || '',
              cta:   ad.creative?.call_to_action_type || '',
            })),
          });
        }
      }
    }

    // ── Buscar período anterior para comparação (todos os agentes) ────────────
    let prevAcctData = {};
    try {
      if (!['maximum'].includes(periodLabel)) {
        const prevPeriodParam = buildPrevPeriodParam(periodLabel, since_var, until_var);
        const prevResp = await metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach&${prevPeriodParam}&level=account&access_token=${token}`);
        prevAcctData = prevResp.data?.[0] || {};
      }
    } catch { /* fallback gracioso */ }

    // ── Dados extras para TRACE ───────────────────────────────────────────────
    let decisionHistory = [];
    let prevAnalyses = [];
    let dailyTrendData = [];
    if (agentId === 'trace') {
      decisionHistory = getDecisionHistory(actId, 45);
      prevAnalyses = getPreviousAnalyses('trace', actId, 3);
      try {
        const dailyResp = await metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,date_start,date_stop&date_preset=last_3d&level=account&time_increment=1&access_token=${token}`);
        dailyTrendData = dailyResp.data || [];
      } catch { /* fallback */ }
    }

    // ── Dados extras para BUCK ────────────────────────────────────────────────
    let monthSpendInfo = {};
    if (agentId === 'buck') {
      try {
        const monthResp = await metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc&date_preset=this_month&level=account&access_token=${token}`);
        const monthData = monthResp.data?.[0] || {};
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        const mtdSpend = parseFloat(monthData.spend || 0);
        const dailyRate = daysPassed > 0 ? mtdSpend / daysPassed : 0;
        const projectedSpend = dailyRate * daysInMonth;
        monthSpendInfo = {
          mtd_spend: mtdSpend,
          days_in_month: daysInMonth,
          days_passed: daysPassed,
          daily_rate: dailyRate.toFixed(2),
          projected_spend: projectedSpend.toFixed(2),
          raw: monthData,
        };
      } catch { /* fallback */ }
    }

    // ── Dados extras para CRIS ────────────────────────────────────────────────
    let placementData = [];
    let championsLib = [];
    if (agentId === 'cris') {
      try {
        const placementResp = await metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,reach&${dateParam}&breakdowns=publisher_platform,placement&level=ad&limit=50&access_token=${token}`);
        if (!placementResp.error) placementData = placementResp.data || [];
      } catch { /* fallback — dado pode não estar disponível */ }
      championsLib = loadMemory().champions.filter(c => c.account === actId).slice(-10);
    }

    // ── Dados extras para REX ─────────────────────────────────────────────────
    let dailyData = [];
    let prevCampaigns = [];
    if (agentId === 'rex') {
      try {
        const dailyResp = await metaGet(`${BASE}/act_${actId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,date_start,date_stop&${dateParam}&level=account&time_increment=1&access_token=${token}`);
        dailyData = dailyResp.data || [];
      } catch { /* fallback */ }
      try {
        if (!['maximum'].includes(periodLabel)) {
          const prevPeriodParam = buildPrevPeriodParam(periodLabel, since_var, until_var);
          const prevCampResp = await metaGet(`${BASE}/act_${actId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm&${prevPeriodParam}&level=campaign&limit=50&access_token=${token}`);
          prevCampaigns = (prevCampResp.data || []).filter(c => parseFloat(c.spend || 0) > 0);
        }
      } catch { /* fallback */ }
    }

    const payload = {
      periodo: periodLabel,
      account: acctData.data?.[0] || {},
      account_prev: prevAcctData,
      campaigns: activeCampaigns,
      total_campanhas_ativas: activeCampaigns.length,
      ...(adsCreativeData.length ? { criativos: adsCreativeData } : {}),
      ...(agentId === 'trace' ? { decision_history: decisionHistory, prev_analyses: prevAnalyses, daily_trend: dailyTrendData } : {}),
      ...(agentId === 'buck' ? { month_spend_info: monthSpendInfo } : {}),
      ...(agentId === 'cris' ? { placement_breakdown: placementData, champions_library: championsLib } : {}),
      ...(agentId === 'rex' ? { daily_data: dailyData, prev_campaigns: prevCampaigns } : {}),
    };

    const def = AGENT_DEFS[agentId];
    // Ada, Cleo e Rex geram conteúdo longo — precisam de mais tokens
    const maxTokens = ['ada', 'cleo', 'rex'].includes(agentId) ? 2400 : 1800;
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: maxTokens, messages: [{ role: 'user', content: def.prompt(payload, periodLabel) }] }),
    });

    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}`);
    const aiResult = await aiResp.json();
    let rawText = (aiResult.content?.[0]?.text || '').trim();
    if (!rawText.startsWith('{')) rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(rawText);

    agents[agentId] = {
      status: 'ready',
      generated_at: new Date().toISOString(),
      period: periodLabel,
      messages: parsed.messages || [],
      raw_data: payload,
    };
    saveAgentsData(agents);

    // ── Salvar análise na memória ─────────────────────────────────────────────
    const mem = loadMemory();
    mem.analyses.push({
      ts: new Date().toISOString(),
      agent: agentId,
      account: actId,
      period: periodLabel,
      metrics: {
        spend: payload.account.spend || 0,
        ctr: payload.account.ctr || 0,
        cpc: payload.account.cpc || 0,
        impressions: payload.account.impressions || 0,
        clicks: payload.account.clicks || 0,
        total_campaigns: activeCampaigns.length,
      }
    });
    // Para Cris: salvar campeão na biblioteca
    if (agentId === 'cris' && activeCampaigns.length > 0) {
      const champ = activeCampaigns
        .filter(c => parseFloat(c.spend || 0) > 15)
        .sort((a, b) => parseFloat(b.ctr || 0) - parseFloat(a.ctr || 0))[0];
      if (champ) {
        const champCreative = adsCreativeData.find(c => c.campaign_id === champ.campaign_id);
        mem.champions.push({
          ts: new Date().toISOString(),
          account: actId,
          campaign_id: champ.campaign_id,
          campaign_name: champ.campaign_name,
          ctr: champ.ctr,
          cpc: champ.cpc,
          spend: champ.spend,
          creative: champCreative?.ads?.[0] || null,
        });
      }
    }
    saveMemory(mem);

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
  const apiKey   = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  const accountId = req.headers['x-acc-id']       || req.body?.accountId;
  const metaToken = req.headers['x-meta-token']   || META_TOKEN;
  const { period } = req.body || {};
  const result = await runAgentAnalysis(id, apiKey, period, accountId, metaToken);
  if (!result.ok) return res.status(500).json({ error: result.msg });
  res.json(loadAgentsData());
});

// ── POST /api/agents/ada/create-campaign ─────────────────────────────────────
app.post('/api/agents/ada/create-campaign', async (req, res) => {
  const { campaign_name, objective, daily_budget_brl, copy_headline, copy_body, cta_type, base_campaign_id } = req.body;
  if (!campaign_name || !copy_body) return res.status(400).json({ ok: false, error: 'campaign_name e copy_body são obrigatórios' });

  // Aceita token do header (configurações do painel) ou variável de ambiente
  const token = req.headers['x-meta-token'] || META_TOKEN;
  if (!token) return res.status(400).json({ ok: false, error: 'META_TOKEN não configurado. Configure o token na aba ⚙️ Configurações.' });

  const accId = req.headers['x-acc-id'] || ACC_ID;

  const metaPost = async (url, params) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, access_token: token }),
    });
    return r.json();
  };

  const metaErr = (resp, ctx) => {
    if (!resp.error) return null;
    const e = resp.error;
    return `${ctx}: ${e.message} (código ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})`;
  };

  try {
    // 1. Buscar targeting da campanha base (se fornecido)
    let targeting = { geo_locations: { countries: ['BR'] }, age_min: 18, age_max: 65 };
    if (base_campaign_id) {
      const adsets = await metaGet(`${BASE}/act_${accId}/adsets?fields=targeting&filtering=${encodeURIComponent(JSON.stringify([{field:'campaign_id',operator:'EQUAL',value:base_campaign_id}]))}&limit=1&access_token=${token}`);
      if (adsets.data?.[0]?.targeting) targeting = adsets.data[0].targeting;
    }

    // 2. Criar campanha (PAUSADA)
    const camp = await metaPost(`${BASE}/act_${accId}/campaigns`, {
      name: campaign_name,
      objective: objective || 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: '[]',
    });
    const campErr = metaErr(camp, 'Criação de campanha');
    if (campErr) throw new Error(campErr);

    // 3. Criar conjunto de anúncios (PAUSADO)
    const adsetParams = {
      name: `${campaign_name} — Conjunto`,
      campaign_id: camp.id,
      daily_budget: String(Math.round((daily_budget_brl || 30) * 100)),
      optimization_goal: 'LEAD_GENERATION',
      billing_event: 'IMPRESSIONS',
      targeting: JSON.stringify(targeting),
      status: 'PAUSED',
      start_time: new Date(Date.now() + 86400000).toISOString(), // amanhã
    };
    const adset = await metaPost(`${BASE}/act_${accId}/adsets`, adsetParams);
    const adsetErr = metaErr(adset, 'Criação do conjunto');
    if (adsetErr) throw new Error(adsetErr);

    const adsManagerUrl = `https://www.facebook.com/adsmanager/manage/campaigns?act=${accId}&selected_campaign_ids=${camp.id}`;

    res.json({
      ok: true,
      campaign_id: camp.id,
      adset_id: adset.id,
      ads_manager_url: adsManagerUrl,
      message: `Campanha "${campaign_name}" criada em modo PAUSADO. Acesse o Gerenciador de Anúncios para adicionar o criativo e publicar.`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/agents/:id/action ───────────────────────────────────────────────
app.post('/api/agents/:id/action', async (req, res) => {
  const { id } = req.params;
  const { message_index, confirmed } = req.body;
  const token  = req.headers['x-meta-token'] || META_TOKEN;
  const accId  = req.headers['x-acc-id']     || ACC_ID;
  const agents = loadAgentsData();
  const agent  = agents[id];
  if (!agent || !agent.messages[message_index]) return res.status(404).json({ error: 'Ação não encontrada' });

  const msg = agent.messages[message_index];
  if (confirmed) {
    try {
      const p = msg.action_payload || {};

      const metaPost = async (endpoint, params) => {
        const r = await fetch(`${BASE}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ...params, access_token: token }),
        });
        const result = await r.json();
        if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
        return result;
      };

      if (msg.action_type === 'pause_campaign' && p.campaign_id) {
        await metaPost(p.campaign_id, { status: 'PAUSED' });

      } else if (msg.action_type === 'update_budget') {
        // SEMPRE busca o orçamento atual da Meta API — nunca confia no valor do payload da IA
        let targetId  = p.adset_id;
        let curBudget = null;  // será preenchido pela API, não pelo payload da IA

        const campaignId = p.campaign_id;
        if (!campaignId && !targetId) throw new Error('campaign_id ou adset_id não encontrado no payload da ação');

        if (targetId) {
          // Adset_id já conhecido — busca orçamento atual
          const adsetResp = await metaGet(`${BASE}/${targetId}?fields=daily_budget,lifetime_budget&access_token=${token}`);
          curBudget = parseInt(adsetResp.daily_budget || adsetResp.lifetime_budget || 0);
        } else {
          // Resolve campaign_id → adset/campanha com orçamento
          const adsetsResp = await metaGet(
            `${BASE}/${campaignId}/adsets?fields=id,daily_budget,lifetime_budget&access_token=${token}`
          );
          const firstAdset = adsetsResp.data?.[0];
          if (firstAdset && (firstAdset.daily_budget || firstAdset.lifetime_budget)) {
            targetId  = firstAdset.id;
            curBudget = parseInt(firstAdset.daily_budget || firstAdset.lifetime_budget || 0);
          } else {
            // CBO: orçamento na campanha
            const campResp = await metaGet(
              `${BASE}/${campaignId}?fields=daily_budget,lifetime_budget&access_token=${token}`
            );
            if (campResp.daily_budget || campResp.lifetime_budget) {
              targetId  = campaignId;
              curBudget = parseInt(campResp.daily_budget || campResp.lifetime_budget || 0);
            } else {
              throw new Error('Orçamento não encontrado na campanha nem no conjunto. Verifique se a campanha está ativa.');
            }
          }
        }

        if (!curBudget || curBudget <= 0) throw new Error(`Orçamento atual inválido (${curBudget}). Verifique se a campanha tem orçamento diário configurado.`);

        // Calcula novo orçamento: usa increase_pct do payload (padrão 20%)
        const pct = parseFloat(p.increase_pct || 20) / 100;
        const newBudget = Math.round(curBudget * (1 + pct));
        const curDisplay = (curBudget / 100).toFixed(2);
        const newDisplay = (newBudget / 100).toFixed(2);
        console.log(`[ACTION] update_budget: ${targetId} ${curDisplay} → ${newDisplay} (+${p.increase_pct || 20}%)`);


        await metaPost(targetId, { daily_budget: String(newBudget) });

      } else if (msg.action_type !== 'info_only' && msg.action_type !== 'download_report') {
        // Tipo de ação desconhecido — marca como executado sem chamar API
      }

      msg.status = 'executed';
    } catch (e) {
      return res.status(500).json({ error: 'Falha ao executar na Meta API: ' + e.message });
    }
  } else {
    msg.status = 'skipped';
  }

  saveAgentsData(agents);

  // ── Salvar decisão na memória ─────────────────────────────────────────────
  const decMem = loadMemory();
  decMem.decisions.push({
    ts: new Date().toISOString(),
    agent: id,
    account: accId,
    action_type: msg.action_type,
    campaign_id: msg.action_payload?.campaign_id || null,
    campaign_name: msg.action_payload?.campaign_name || null,
    status: confirmed ? 'executed' : 'skipped',
    increase_pct: msg.action_payload?.increase_pct || null,
  });
  saveMemory(decMem);

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
