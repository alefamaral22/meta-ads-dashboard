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

// ── GET /api/debug ────────────────────────────────────────────────────────────
app.get('/api/debug', async (req, res) => {
  const tokenPreview = META_TOKEN ? META_TOKEN.slice(0, 12) + '...' : 'NÃO DEFINIDO';
  const testUrl = `${BASE}/act_${ACC_ID}/insights?fields=spend&date_preset=last_7d&level=account&access_token=${META_TOKEN}`;
  const testResult = await metaGet(testUrl);
  res.json({
    token_preview: tokenPreview,
    acc_id: ACC_ID,
    pixel_id: PIXEL_ID,
    is_vercel: isVercel,
    meta_test: testResult,
  });
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

// Localmente sobe o servidor normalmente; no Vercel exporta o app como handler
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n✅ Dashboard:      http://localhost:${PORT}/meta-dashboard.html`);
    console.log(`✅ Registrar venda: http://localhost:${PORT}/vendas.html\n`);
  });
}

export default app;
