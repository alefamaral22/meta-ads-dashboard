/**
 * Meta Ads Client — Time de Trafego Pago
 *
 * Cliente para a Meta Marketing API (Facebook Ads)
 * Cobre: campanhas, conjuntos, anuncios, insights e orcamento.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api
 */

const axios = require('axios');

class MetaAdsClient {
  constructor(options = {}) {
    this.accessToken = options.accessToken || process.env.META_ACCESS_TOKEN
      || process.env.INSTAGRAM_ACCESS_TOKEN; // fallback para token do insbot
    this.adAccountId = options.adAccountId || process.env.META_AD_ACCOUNT_ID;
    this.apiVersion = options.apiVersion || process.env.META_API_VERSION || 'v19.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  // ─── CAMPANHAS ────────────────────────────────────────────────────────────

  /**
   * Lista todas as campanhas da conta
   * @param {string} [status] - 'ACTIVE' | 'PAUSED' | 'ALL' (default: ALL)
   */
  async getCampaigns(status = 'ALL') {
    const fields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time';
    const params = { fields };
    if (status !== 'ALL') params.effective_status = JSON.stringify([status]);

    return this._get(`/${this.adAccountId}/campaigns`, params);
  }

  /**
   * Busca insights de performance de campanhas
   * @param {Object} options - dateRange, level, breakdowns
   */
  async getCampaignInsights(options = {}) {
    const {
      dateRange = { since: this._daysAgo(7), until: this._today() },
      level = 'campaign',
      fields = 'campaign_name,impressions,reach,clicks,ctr,cpc,cpm,spend,actions,action_values,roas',
    } = options;

    return this._get(`/${this.adAccountId}/insights`, {
      fields,
      level,
      time_range: JSON.stringify(dateRange),
      limit: 100,
    });
  }

  // ─── CONJUNTOS DE ANUNCIOS ────────────────────────────────────────────────

  /**
   * Lista conjuntos de anuncios (ad sets) de uma campanha
   */
  async getAdSets(campaignId) {
    const fields = 'id,name,status,targeting,daily_budget,lifetime_budget,bid_amount,optimization_goal';
    return this._get(`/${campaignId}/adsets`, { fields });
  }

  /**
   * Insights por conjunto de anuncios
   */
  async getAdSetInsights(campaignId, dateRange) {
    const range = dateRange || { since: this._daysAgo(7), until: this._today() };
    return this._get(`/${campaignId}/insights`, {
      fields: 'adset_name,impressions,reach,clicks,ctr,cpc,cpm,spend,actions,frequency',
      level: 'adset',
      time_range: JSON.stringify(range),
    });
  }

  // ─── ANUNCIOS ─────────────────────────────────────────────────────────────

  /**
   * Lista anuncios de um conjunto
   */
  async getAds(adSetId) {
    const fields = 'id,name,status,creative{title,body,image_url,thumbnail_url,call_to_action}';
    return this._get(`/${adSetId}/ads`, { fields });
  }

  /**
   * Insights por anuncio individual (nivel criativo)
   */
  async getAdInsights(adSetId, dateRange) {
    const range = dateRange || { since: this._daysAgo(7), until: this._today() };
    return this._get(`/${adSetId}/insights`, {
      fields: 'ad_name,impressions,reach,clicks,ctr,cpc,spend,actions,video_avg_time_watched_actions',
      level: 'ad',
      time_range: JSON.stringify(range),
    });
  }

  // ─── ORCAMENTO ────────────────────────────────────────────────────────────

  /**
   * Atualiza orcamento diario de uma campanha ou conjunto
   * @param {string} entityId - ID da campanha ou conjunto
   * @param {number} dailyBudgetCents - Orcamento em centavos (ex: 5000 = R$50,00)
   */
  async updateDailyBudget(entityId, dailyBudgetCents) {
    return this._post(`/${entityId}`, { daily_budget: dailyBudgetCents });
  }

  /**
   * Pausa uma campanha ou conjunto
   */
  async pause(entityId) {
    return this._post(`/${entityId}`, { status: 'PAUSED' });
  }

  /**
   * Ativa uma campanha ou conjunto
   */
  async activate(entityId) {
    return this._post(`/${entityId}`, { status: 'ACTIVE' });
  }

  // ─── CONTA ────────────────────────────────────────────────────────────────

  /**
   * Informacoes gerais da conta de anuncios
   */
  async getAccountInfo() {
    const fields = 'id,name,currency,timezone_name,spend_cap,amount_spent,balance,account_status';
    return this._get(`/${this.adAccountId}`, { fields });
  }

  /**
   * Gasto total no periodo
   */
  async getTotalSpend(dateRange) {
    const range = dateRange || { since: this._daysAgo(30), until: this._today() };
    return this._get(`/${this.adAccountId}/insights`, {
      fields: 'spend,impressions,clicks,actions',
      level: 'account',
      time_range: JSON.stringify(range),
    });
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  async _get(endpoint, params = {}) {
    this._validate();
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: { ...params, access_token: this.accessToken },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  async _post(endpoint, data = {}) {
    this._validate();
    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, null, {
        params: { ...data, access_token: this.accessToken },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  // ─── UTILS ────────────────────────────────────────────────────────────────

  _validate() {
    if (!this.accessToken) throw new Error('META_ACCESS_TOKEN nao configurado. Copie .env.example para .env');
    if (!this.adAccountId) throw new Error('META_AD_ACCOUNT_ID nao configurado. Formato: act_XXXXXXXXXX');
  }

  _today() {
    return new Date().toISOString().split('T')[0];
  }

  _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  _parseError(error) {
    const apiError = error.response?.data?.error;
    if (apiError) {
      return { code: apiError.code, message: apiError.message, type: apiError.type };
    }
    return { code: 'UNKNOWN', message: error.message };
  }
}

module.exports = MetaAdsClient;
