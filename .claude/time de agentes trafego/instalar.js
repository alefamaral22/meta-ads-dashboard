#!/usr/bin/env node
/**
 * Instalador — Time de Tráfego Pago
 * Configura o squad em qualquer máquina em menos de 2 minutos.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const ROOT = __dirname;
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const ENV_FILE    = path.join(ROOT, '.env');

const verde   = (t) => `\x1b[32m${t}\x1b[0m`;
const amarelo = (t) => `\x1b[33m${t}\x1b[0m`;
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`;
const negrito  = (t) => `\x1b[1m${t}\x1b[0m`;

function linha() { console.log('─'.repeat(55)); }

function perguntar(rl, pergunta) {
  return new Promise((resolve) => rl.question(pergunta, resolve));
}

async function main() {
  console.clear();
  linha();
  console.log(negrito('  📊 Time de Tráfego Pago — Instalador'));
  console.log('  Agentes: Trace · Buck · Cris · Rex · Ada · Cleo');
  linha();
  console.log('');

  // 1. Verificar Node.js
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  if (major < 16) {
    console.log(vermelho(`✗ Node.js ${nodeVersion} muito antigo. Instale a versão 18+`));
    console.log('  Download: https://nodejs.org');
    process.exit(1);
  }
  console.log(verde(`✓ Node.js ${nodeVersion}`));

  // 2. Instalar dependências
  console.log(amarelo('  Instalando dependências (axios)...'));
  try {
    execSync('npm install axios --save', { cwd: ROOT, stdio: 'ignore' });
    console.log(verde('✓ Dependências instaladas'));
  } catch {
    console.log(vermelho('✗ Erro ao instalar. Tente: npm install axios'));
    process.exit(1);
  }

  // 3. Verificar se .env já existe
  if (fs.existsSync(ENV_FILE)) {
    console.log(verde('✓ Arquivo .env já existe — pulando configuração'));
    finalizar();
    return;
  }

  // 4. Coletar credenciais Meta
  console.log('');
  linha();
  console.log(negrito('  🔑 Configuração das credenciais Meta Ads'));
  linha();
  console.log('');
  console.log('  Você vai precisar de:');
  console.log('  1. Meta Access Token — no Meta Business Suite >');
  console.log('     Configurações > Acesso à API');
  console.log('  2. ID da conta de anúncios — no Gerenciador de');
  console.log('     Anúncios, no topo (formato: act_XXXXXXXXXX)');
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const token     = await perguntar(rl, '  Cole seu META_ACCESS_TOKEN: ');
  const accountId = await perguntar(rl, '  Cole seu META_AD_ACCOUNT_ID (ex: act_123456): ');
  const pageId    = await perguntar(rl, '  Cole seu META_PAGE_ID (opcional, Enter para pular): ');

  rl.close();

  // 5. Criar .env
  const envContent = fs.readFileSync(ENV_EXAMPLE, 'utf8')
    .replace('META_ACCESS_TOKEN=', `META_ACCESS_TOKEN=${token.trim()}`)
    .replace('META_AD_ACCOUNT_ID=act_', `META_AD_ACCOUNT_ID=${accountId.trim()}`)
    .replace('META_PAGE_ID=', `META_PAGE_ID=${pageId.trim()}`);

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  console.log('');
  console.log(verde('✓ Arquivo .env criado com sucesso'));

  finalizar();
}

function finalizar() {
  console.log('');
  linha();
  console.log(negrito('  ✅ Instalação concluída! Seus agentes:'));
  linha();
  console.log('');
  console.log('  📊 @traffic-analyst (Trace) — analisa campanhas');
  console.log('  💰 @budget-optimizer (Buck) — otimiza orçamento');
  console.log('  🎨 @creative-reviewer (Cris) — revisa criativos');
  console.log('  📋 @report-writer (Rex)    — gera relatórios');
  console.log('  ✍️  @ad-creator (Ada)        — cria anúncios');
  console.log('  🎬 @creative-director (Cleo) — briefs de vídeo');
  console.log('');
  console.log('  Como usar no Claude Code:');
  console.log(amarelo('  @traffic-analyst *analisar'));
  console.log(amarelo('  @budget-optimizer *analisar-orcamento'));
  console.log(amarelo('  @report-writer *relatorio-mensal'));
  console.log('');
  linha();
}

main().catch((err) => {
  console.error(vermelho('Erro inesperado:'), err.message);
  process.exit(1);
});
