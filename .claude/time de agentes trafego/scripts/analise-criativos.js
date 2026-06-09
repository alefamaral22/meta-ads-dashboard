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

  const insights = await get('/' + AD_ACCOUNT + '/insights', {
    fields: 'ad_id,ad_name,adset_name,campaign_name,impressions,reach,clicks,ctr,cpc,cpm,spend,frequency,actions,action_values',
    level: 'ad',
    time_range: JSON.stringify({ since: d7, until: today }),
    limit: 50,
    sort: 'spend_descending',
  });

  if (!insights.data) {
    console.log(JSON.stringify(insights));
    return;
  }

  for (const ad of insights.data) {
    const purchases = (ad.actions || []).find((a) => a.action_type === 'purchase')?.value || 0;
    const checkouts = (ad.actions || []).find((a) => a.action_type === 'initiate_checkout')?.value || 0;
    const landingViews = (ad.actions || []).find((a) => a.action_type === 'landing_page_view')?.value || 0;
    const videoViews = (ad.actions || []).find((a) => a.action_type === 'video_view')?.value || 0;
    const purchaseValue = (ad.action_values || []).find((a) => a.action_type === 'purchase')?.value || 0;
    const roas = purchaseValue > 0 ? (parseFloat(purchaseValue) / parseFloat(ad.spend)).toFixed(2) : '0';
    const freq = parseFloat(ad.frequency || 1).toFixed(2);
    const ctr = parseFloat(ad.ctr).toFixed(2);
    const cpc = parseFloat(ad.cpc).toFixed(2);
    const cpm = parseFloat(ad.cpm).toFixed(2);

    // Classificacao
    let status = '';
    if (parseFloat(ctr) >= 2 && parseFloat(freq) < 2) status = 'BOM';
    else if (parseFloat(freq) >= 3) status = 'SATURADO';
    else if (parseFloat(ctr) < 0.5) status = 'RUIM';
    else if (parseInt(checkouts) > 0 && parseInt(purchases) === 0) status = 'CHECKOUT_ABANDONO';
    else status = 'ATENCAO';

    console.log('---');
    console.log('CRIATIVO: ' + ad.ad_name + '  [' + status + ']');
    console.log('Campanha: ' + ad.campaign_name);
    console.log('Conjunto: ' + ad.adset_name);
    console.log(
      'Gasto: R$' + ad.spend +
      ' | CTR: ' + ctr + '%' +
      ' | CPC: R$' + cpc +
      ' | CPM: R$' + cpm +
      ' | Freq: ' + freq
    );
    console.log(
      'Impressoes: ' + ad.impressions +
      ' | Alcance: ' + ad.reach +
      ' | Cliques: ' + ad.clicks +
      ' | LPV: ' + landingViews
    );
    console.log(
      'Checkouts: ' + checkouts +
      ' | Vendas: ' + purchases +
      ' (R$' + purchaseValue + ')' +
      ' | ROAS: ' + roas + 'x'
    );
    if (videoViews > 0) console.log('Views video: ' + videoViews);
  }

  console.log('\nTOTAL DE CRIATIVOS: ' + insights.data.length);
}

main().catch(console.error);
