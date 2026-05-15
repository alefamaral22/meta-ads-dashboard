// ============================================================
// Bitcoin Dashboard — app.js (versão final)
// ============================================================

const API_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 60_000; // 60 segundos

// Guarda as instâncias dos gráficos para poder destruí-las antes de criar novas
const instancias = { principal: null, semanal: null, anual: null };

// Período ativo no gráfico principal (em dias)
let periodoAtivo = 7;

// ============================================================
// FORMATAÇÃO
// ============================================================

function formatarMoeda(valor) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(valor);
}

function formatarMoedaCompacta(valor) {
  if (valor >= 1e12) return `$${(valor / 1e12).toFixed(2)}T`;
  if (valor >= 1e9)  return `$${(valor / 1e9).toFixed(2)}B`;
  if (valor >= 1e6)  return `$${(valor / 1e6).toFixed(2)}M`;
  return formatarMoeda(valor);
}

function formatarPorcentagem(valor) {
  return `${valor >= 0 ? '+' : ''}${valor.toFixed(2)}%`;
}

function formatarDataHora(data) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(data);
}

// Formata o label do eixo X do gráfico conforme o período selecionado
function formatarEixoX(timestamp, dias) {
  const d = new Date(timestamp);
  if (dias <= 2)  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dias <= 90) return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

// Formata a data completa para o tooltip ao passar o mouse no gráfico
function formatarTooltip(timestamp, dias) {
  const opcoes = dias <= 2
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'long', year: 'numeric' };
  return new Date(timestamp).toLocaleDateString('pt-BR', opcoes);
}

// ============================================================
// CACHE LOCAL (localStorage)
// Evita chamar a API a cada clique — dados ficam salvos por 60s
// ============================================================

function salvarCache(chave, dados) {
  try {
    localStorage.setItem(chave, JSON.stringify({ dados, expira: Date.now() + CACHE_TTL }));
  } catch { /* localStorage cheio — ignora silenciosamente */ }
}

function lerCache(chave) {
  try {
    const raw = localStorage.getItem(chave);
    if (!raw) return null;
    const entrada = JSON.parse(raw);
    if (Date.now() > entrada.expira) { localStorage.removeItem(chave); return null; }
    return entrada.dados;
  } catch { return null; }
}

// ============================================================
// CHAMADAS À API DA COINGECKO
// ============================================================

async function buscarDadosAtuais(forcar = false) {
  const CHAVE = 'btc_resumo';
  if (!forcar) { const c = lerCache(CHAVE); if (c) return c; }

  const url =
    `${API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd` +
    `&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Erro ${r.status}`);
  const dados = (await r.json()).bitcoin;
  salvarCache(CHAVE, dados);
  return dados;
}

async function buscarHistorico(dias, forcar = false) {
  const CHAVE = `btc_hist_${dias}`;
  if (!forcar) { const c = lerCache(CHAVE); if (c) return c; }

  const r = await fetch(`${API_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${dias}`);
  if (!r.ok) throw new Error(`Erro ${r.status}`);
  const dados = (await r.json()).prices;
  salvarCache(CHAVE, dados);
  return dados;
}

async function buscarHistoricoRange(from, to) {
  const r = await fetch(
    `${API_BASE}/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
  );
  if (!r.ok) throw new Error(`Erro ${r.status}`);
  return (await r.json()).prices;
}

// ============================================================
// PROCESSAMENTO DOS DADOS BRUTOS
// Reduz pontos se necessário para o gráfico não ficar pesado
// ============================================================

function processarDados(rawPrices, dias, maxPontos = 200) {
  let lista = rawPrices;

  if (lista.length > maxPontos) {
    const passo = Math.ceil(lista.length / maxPontos);
    lista = lista.filter((_, i) => i % passo === 0);
    // Garante que o último ponto (preço mais recente) sempre apareça
    if (lista[lista.length - 1] !== rawPrices[rawPrices.length - 1]) {
      lista.push(rawPrices[rawPrices.length - 1]);
    }
  }

  return {
    labels:     lista.map(([ts])      => formatarEixoX(ts, dias)),
    valores:    lista.map(([, preco]) => preco),
    timestamps: lista.map(([ts])      => ts),
  };
}

// ============================================================
// GRÁFICOS — Chart.js
// ============================================================

function criarGradiente(ctx, corHex) {
  const h = ctx.canvas.height || 300;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,   corHex + '40'); // 25% opacidade no topo
  grad.addColorStop(0.7, corHex + '10'); // quase transparente no meio
  grad.addColorStop(1,   corHex + '00'); // totalmente transparente na base
  return grad;
}

function configuracaoGrafico(canvas, labels, valores, timestamps, dias, pequeno) {
  const ctx       = canvas.getContext('2d');
  const BITCOIN   = '#f7931a';
  const BORDA     = '#30363d';
  const TEXTO     = '#8b949e';

  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: valores,
        borderColor: BITCOIN,
        borderWidth: pequeno ? 1.5 : 2,
        backgroundColor: criarGradiente(ctx, BITCOIN),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: pequeno ? 4 : 6,
        pointHoverBackgroundColor: BITCOIN,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor: BORDA,
          borderWidth: 1,
          titleColor: TEXTO,
          bodyColor: '#e6edf3',
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => formatarTooltip(timestamps[items[0].dataIndex], dias),
            label: (item)  => `  Preço: ${formatarMoeda(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid:   { color: BORDA },
          ticks:  {
            color: TEXTO,
            maxTicksLimit: pequeno ? 4 : 7,
            maxRotation: 0,
            font: { size: 11, family: 'Inter, system-ui, sans-serif' },
          },
        },
        y: {
          position: 'right',
          border: { display: false },
          grid:   { color: BORDA },
          ticks:  {
            color: TEXTO,
            font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            callback: (v) => formatarMoedaCompacta(v),
          },
        },
      },
    },
  };
}

function renderizarGrafico(canvasId, chave, rawPrices, dias, pequeno = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destrói o gráfico anterior para liberar memória
  if (instancias[chave]) {
    instancias[chave].destroy();
    instancias[chave] = null;
  }

  const { labels, valores, timestamps } = processarDados(rawPrices, dias, pequeno ? 120 : 250);
  instancias[chave] = new Chart(canvas, configuracaoGrafico(canvas, labels, valores, timestamps, dias, pequeno));
}

// ============================================================
// ESTADOS DE CARREGAMENTO DOS GRÁFICOS
// ============================================================

function mostrarLoadingGrafico(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function ocultarLoadingGrafico(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ============================================================
// CARDS DE RESUMO
// ============================================================

function mostrarCarregandoCards() {
  ['precoAtual', 'variacao24h', 'volume24h', 'marketCap'].forEach((id) => {
    document.getElementById(id).innerHTML = '<span class="skeleton">Carregando...</span>';
  });
  document.getElementById('variacao24h').className = 'card__valor card__valor--neutro';
}

function preencherCards(dados) {
  document.getElementById('precoAtual').textContent = formatarMoeda(dados.usd);

  const varEl = document.getElementById('variacao24h');
  const v = dados.usd_24h_change;
  varEl.textContent  = formatarPorcentagem(v);
  varEl.className    = `card__valor ${v >= 0 ? 'card__valor--positivo' : 'card__valor--negativo'}`;

  document.getElementById('volume24h').textContent = formatarMoedaCompacta(dados.usd_24h_vol);
  document.getElementById('marketCap').textContent  = formatarMoedaCompacta(dados.usd_market_cap);
}

// ============================================================
// ERRO E TIMESTAMP
// ============================================================

function mostrarErro()  { document.getElementById('alertaErro').hidden = false; }
function ocultarErro()  { document.getElementById('alertaErro').hidden = true;  }

function atualizarTimestamp() {
  document.getElementById('ultimaAtualizacao').textContent =
    `Atualizado: ${formatarDataHora(new Date())}`;
}

// ============================================================
// LOADERS — funções que buscam e exibem dados
// ============================================================

async function carregarResumo(forcar = false) {
  const btn = document.getElementById('btnAtualizar');
  try {
    ocultarErro();
    mostrarCarregandoCards();
    btn.disabled    = true;
    btn.textContent = '↻ Buscando...';

    const dados = await buscarDadosAtuais(forcar);
    preencherCards(dados);
    atualizarTimestamp();
  } catch (e) {
    console.error('Resumo:', e);
    mostrarErro();
    ['precoAtual', 'variacao24h', 'volume24h', 'marketCap'].forEach((id) => {
      document.getElementById(id).textContent = '—';
    });
  } finally {
    btn.disabled    = false;
    btn.textContent = '↻ Atualizar';
  }
}

async function carregarGraficoPrincipal(dias, from = null, to = null, forcar = false) {
  mostrarLoadingGrafico('loadingPrincipal');
  try {
    let dados;
    let diasEfetivos = dias;

    if (from && to) {
      dados = await buscarHistoricoRange(from, to);
      diasEfetivos = Math.round((to - from) / 86400);
    } else {
      dados = await buscarHistorico(dias, forcar);
    }

    renderizarGrafico('graficoPrincipal', 'principal', dados, diasEfetivos);
  } catch (e) {
    console.error('Gráfico principal:', e);
    mostrarErro();
  } finally {
    ocultarLoadingGrafico('loadingPrincipal');
  }
}

async function carregarGraficosSecundarios(forcar = false) {
  mostrarLoadingGrafico('loadingSemanal');
  mostrarLoadingGrafico('loadingAnual');

  // Busca os dois ao mesmo tempo — não espera um terminar para começar o outro
  const [resSemana, resAno] = await Promise.allSettled([
    buscarHistorico(7, forcar),
    buscarHistorico(365, forcar),
  ]);

  if (resSemana.status === 'fulfilled') {
    renderizarGrafico('graficoSemanal', 'semanal', resSemana.value, 7, true);
  }
  ocultarLoadingGrafico('loadingSemanal');

  if (resAno.status === 'fulfilled') {
    renderizarGrafico('graficoAnual', 'anual', resAno.value, 365, true);
  }
  ocultarLoadingGrafico('loadingAnual');
}

// ============================================================
// SELETOR DE PERÍODO
// ============================================================

function ativarBotaoPeriodo(valor) {
  document.querySelectorAll('.seletor-periodo__btn').forEach((btn) => {
    btn.classList.toggle('seletor-periodo__btn--ativo', String(btn.dataset.dias) === String(valor));
  });
}

function mostrarSeletorDatas(mostrar) {
  document.getElementById('seletorDatas').hidden = !mostrar;
}

function configurarInputsDatas() {
  const hoje    = new Date().toISOString().split('T')[0];
  const ha30d   = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const inicio  = document.getElementById('dataInicio');
  const fim     = document.getElementById('dataFim');

  inicio.max   = hoje;
  fim.max      = hoje;
  inicio.value = ha30d;
  fim.value    = hoje;
}

// ============================================================
// EVENTOS DOS BOTÕES
// ============================================================

// Botões de período rápido: 7D, 30D, 90D, 1A, Personalizado
document.querySelectorAll('.seletor-periodo__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const dias = btn.dataset.dias;

    if (dias === 'custom') {
      ativarBotaoPeriodo('custom');
      mostrarSeletorDatas(true);
      return;
    }

    mostrarSeletorDatas(false);
    periodoAtivo = Number(dias);
    ativarBotaoPeriodo(dias);
    carregarGraficoPrincipal(periodoAtivo);
  });
});

// Botão "Buscar" do seletor personalizado
document.getElementById('btnBuscarPeriodo').addEventListener('click', () => {
  const inicioStr = document.getElementById('dataInicio').value;
  const fimStr    = document.getElementById('dataFim').value;

  if (!inicioStr || !fimStr) return;

  // A API exige timestamps em segundos, não milissegundos
  const from = Math.floor(new Date(inicioStr).getTime() / 1000);
  const to   = Math.floor(new Date(fimStr + 'T23:59:59').getTime() / 1000);

  if (from >= to) {
    alert('A data de início deve ser anterior à data final.');
    return;
  }

  carregarGraficoPrincipal(null, from, to);
});

// Atualiza tudo ao clicar em "Atualizar" no cabeçalho
document.getElementById('btnAtualizar').addEventListener('click', () => {
  carregarResumo(true);
  carregarGraficoPrincipal(periodoAtivo, null, null, true);
  carregarGraficosSecundarios(true);
});

// Botão "Tentar novamente" do alerta de erro
document.getElementById('btnTentarNovamente').addEventListener('click', inicializar);

// ============================================================
// INICIALIZAÇÃO — roda ao abrir a página
// ============================================================

async function inicializar() {
  configurarInputsDatas();

  // Carrega cards e gráficos em paralelo para ser mais rápido
  await Promise.allSettled([
    carregarResumo(),
    carregarGraficoPrincipal(periodoAtivo),
    carregarGraficosSecundarios(),
  ]);
}

document.addEventListener('DOMContentLoaded', inicializar);
