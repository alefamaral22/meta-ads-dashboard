const TOKEN = 'EAAUZCncL5VEEBQ5VrZCmqlpSkh1Ph9FZBqTCxHvPyUkt0ckbkU1Ayae3goADBMtvcoXEZCMcaXY2HGxAeY88BnThZBCgk3XdfB27O8UMVLDLOrnxV1tghwpjU7YQWtPGBi3nLR2P3bySCk5BWteJGE3ij1oEJlJzJ1rdXSF8OAlQHyBmbbb051ORjOiVDbZARMeGuv5DqbnAYi';
const AD_ACCOUNT = 'act_1550015673109767';
const BASE = 'https://graph.facebook.com/v19.0';

async function get(endpoint, params) {
  const url = new URL(BASE + endpoint);
  url.searchParams.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  return res.json();
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const activeFilter = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]);

  const [camps, insights, adsets, ads] = await Promise.all([
    get('/' + AD_ACCOUNT + '/campaigns', {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget',
      filtering: activeFilter,
      limit: 50,
    }),
    get('/' + AD_ACCOUNT + '/insights', {
      fields: 'campaign_id,campaign_name,impressions,reach,clicks,ctr,spend,actions,action_values',
      level: 'campaign',
      time_range: JSON.stringify({ since: d7, until: today }),
      limit: 20,
    }),
    get('/' + AD_ACCOUNT + '/adsets', {
      fields: 'id,name,status,campaign_id,daily_budget,targeting',
      filtering: activeFilter,
      limit: 50,
    }),
    get('/' + AD_ACCOUNT + '/ads', {
      fields: 'id,name,status,adset_id,campaign_id',
      filtering: activeFilter,
      limit: 100,
    }),
  ]);

  // --- CAMPANHAS ---
  console.log('\n==============================');
  console.log('  CAMPANHAS ATIVAS: ' + camps.data.length);
  console.log('==============================');
  for (const c of camps.data) {
    const budget = c.daily_budget
      ? 'R$' + (parseInt(c.daily_budget) / 100).toFixed(2) + '/dia'
      : c.lifetime_budget
      ? 'R$' + (parseInt(c.lifetime_budget) / 100).toFixed(2) + ' total'
      : 'sem orcamento definido';
    console.log('- ' + c.name);
    console.log('  Objetivo: ' + c.objective + ' | Orcamento: ' + budget);
  }

  // --- INSIGHTS 7 DIAS ---
  let totalSpend = 0;
  let totalPurchases = 0;
  let totalPurchaseValue = 0;
  let totalCheckouts = 0;
  const insightMap = {};

  for (const i of (insights.data || [])) {
    totalSpend += parseFloat(i.spend || 0);
    const purchases = (i.actions || []).find((a) => a.action_type === 'purchase')?.value || 0;
    const checkouts = (i.actions || []).find((a) => a.action_type === 'initiate_checkout')?.value || 0;
    const purchaseValue = (i.action_values || []).find((a) => a.action_type === 'purchase')?.value || 0;
    totalPurchases += parseInt(purchases);
    totalCheckouts += parseInt(checkouts);
    totalPurchaseValue += parseFloat(purchaseValue);
    insightMap[i.campaign_id] = { spend: i.spend, ctr: i.ctr, clicks: i.clicks, purchases, checkouts, purchaseValue };
  }

  console.log('\n==============================');
  console.log('  RESUMO FINANCEIRO (7 dias)');
  console.log('==============================');
  console.log('Gasto total:       R$' + totalSpend.toFixed(2));
  console.log('Receita gerada:    R$' + totalPurchaseValue.toFixed(2));
  console.log('ROAS geral:        ' + (totalPurchaseValue > 0 ? (totalPurchaseValue / totalSpend).toFixed(2) : '0') + 'x');
  console.log('Vendas (compras):  ' + totalPurchases);
  console.log('Checkouts iniciados: ' + totalCheckouts);

  // --- CONJUNTOS ---
  const comInteresse = adsets.data.filter((a) => {
    const specs = a.targeting && a.targeting.flexible_spec;
    return specs && specs.length > 0;
  });
  const semInteresse = adsets.data.filter((a) => {
    const specs = a.targeting && a.targeting.flexible_spec;
    return !specs || specs.length === 0;
  });

  console.log('\n==============================');
  console.log('  CONJUNTOS ATIVOS: ' + adsets.data.length);
  console.log('==============================');
  console.log('Com publico de interesses: ' + comInteresse.length);
  console.log('Abertos (sem interesses):  ' + semInteresse.length);

  if (comInteresse.length > 0) {
    console.log('\nCONJUNTOS COM PUBLICO (para limpar):');
    for (const a of comInteresse) {
      const interests = (a.targeting.flexible_spec || []).flatMap((s) => (s.interests || []).map((i) => i.name));
      console.log('  - ' + a.name + ' | ID: ' + a.id);
      console.log('    Interesses: ' + interests.slice(0, 3).join(', ') + (interests.length > 3 ? '...' : ''));
    }
  }

  // --- ANUNCIOS ---
  console.log('\n==============================');
  console.log('  ANUNCIOS ATIVOS: ' + (ads.data ? ads.data.length : 0));
  console.log('==============================');

  // Agrupar por campanha
  const adsByCamp = {};
  for (const ad of (ads.data || [])) {
    if (!adsByCamp[ad.campaign_id]) adsByCamp[ad.campaign_id] = 0;
    adsByCamp[ad.campaign_id]++;
  }
  for (const [campId, count] of Object.entries(adsByCamp)) {
    const camp = camps.data.find((c) => c.id === campId);
    const name = camp ? camp.name : campId;
    console.log('  ' + count + ' anuncios — ' + name);
  }
}

main().catch(console.error);
