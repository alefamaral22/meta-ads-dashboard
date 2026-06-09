// Composição CentralizaAI Group — Reel de vendas 9:16
// 7 cenas · ~60s · Voz pf_dora PT-BR
import { writeFileSync, readFileSync } from "node:fs";

const FONT_CSS = readFileSync(new URL("./assets/fonts/fonts.css", import.meta.url), "utf8")
  .replace(/\.\/fonts\//g, "assets/fonts/");

// Apenas 9:16 (Shorts/Reels)
const VERT = true;
const W = 1080;
const H = 1920;
const OUT = "index.html";

// Durações REAIS medidas por ffprobe
const AUDIO = [4.480, 5.440, 5.653, 6.997, 5.568, 5.291, 7.125];

const LEAD = 0.5;
const TAIL = 0.9;
const FADE = 0.45;

let t = 0;
const S = AUDIO.map((a, i) => {
  const dur = LEAD + a + TAIL;
  const o = { i: i + 1, start: round(t), dur: round(dur), audioStart: round(t + LEAD), audioDur: round(a), end: round(t + dur) };
  t += dur;
  return o;
});
const TOTAL = round(t);
function round(n) { return Math.round(n * 1000) / 1000; }

const CAPTIONS = [
  "Sua empresa perde tempo com tarefas repetitivas?",
  "CentralizaAI Group — IA que trabalha por você",
  "Chatbots inteligentes que atendem e vendem 24h",
  "Marketing automatizado no piloto automático",
  "Relatórios com IA em tempo real",
  "Resultados em dias, não meses",
  "centralizaaigroup.org/landing",
];

// ── CENA 1: Hook / Dor ──────────────────────────────────────────────────────
function scene1() {
  return `
    <div class="eyebrow" id="s1-eyebrow"><span class="dot"></span>CENTRALIZA<span class="accent">AI</span> GROUP</div>
    <h1 class="title" id="s1-title">
      <span class="word muted">Sua empresa ainda</span>
      <span class="word">perde tempo</span>
      <span class="word accent">e dinheiro</span>
    </h1>
    <div class="rule" id="s1-rule"></div>
    <p class="subhead" id="s1-sub">em tarefas que a IA poderia fazer?</p>
    <div class="reg tl" id="s1-r1"></div><div class="reg br" id="s1-r2"></div>`;
}

// ── CENA 2: Apresentação ─────────────────────────────────────────────────────
function scene2() {
  return `
    <div class="brand-wrap" id="s2-brand">
      <div class="brand-glow" id="s2-glow"></div>
      <div class="brand-logo" id="s2-logo">
        <span class="logo-c">C</span><span class="logo-ai">AI</span>
      </div>
    </div>
    <h1 class="brand-name" id="s2-name">CentralizaAI Group</h1>
    <div class="rule center" id="s2-rule"></div>
    <p class="brand-tagline" id="s2-tag">IA que trabalha por você — 24 horas por dia</p>`;
}

// ── CENA 3: Agentes de IA / Chatbots ─────────────────────────────────────────
function scene3() {
  return `
    <div class="feat-kicker" id="s3-k"><span class="feat-num">01</span>AGENTES DE IA</div>
    <h2 class="feat-title" id="s3-h">Chatbots que<br/><span class="accent">atendem e vendem</span><br/>sem parar.</h2>
    <div class="chat-demo" id="s3-chat">
      <div class="chat-msg bot" id="s3-m1"><span class="chat-dot"></span>Olá! Como posso ajudar sua empresa?</div>
      <div class="chat-msg user" id="s3-m2">Quero saber sobre os planos</div>
      <div class="chat-msg bot" id="s3-m3"><span class="chat-dot"></span>Perfeito! Temos 3 planos a partir de R$ 97/mês ✅</div>
    </div>
    <div class="feat-badge" id="s3-badge">24h · 7 dias · Sem pausa</div>`;
}

// ── CENA 4: Automação de Marketing ───────────────────────────────────────────
function scene4() {
  return `
    <div class="feat-kicker" id="s4-k"><span class="feat-num">02</span>AUTOMAÇÃO</div>
    <h2 class="feat-title" id="s4-h">Marketing no<br/><span class="accent">piloto automático.</span></h2>
    <div class="funnel" id="s4-funnel">
      <div class="f-step" id="s4-f1"><span class="f-icon">📧</span><span class="f-label">E-mail / WhatsApp</span><span class="f-arrow">↓</span></div>
      <div class="f-step" id="s4-f2"><span class="f-icon">🔁</span><span class="f-label">Sequência automática</span><span class="f-arrow">↓</span></div>
      <div class="f-step accent-step" id="s4-f3"><span class="f-icon">🏆</span><span class="f-label">Conversão garantida</span></div>
    </div>`;
}

// ── CENA 5: Relatórios com IA ─────────────────────────────────────────────────
function scene5() {
  return `
    <div class="feat-kicker" id="s5-k"><span class="feat-num">03</span>ANÁLISES COM IA</div>
    <h2 class="feat-title" id="s5-h">Decisões com<br/><span class="accent">dados reais,</span><br/>em tempo real.</h2>
    <div class="metrics" id="s5-metrics">
      <div class="metric-card" id="s5-m1">
        <div class="metric-val accent" id="s5-v1">+247%</div>
        <div class="metric-label">Leads gerados</div>
      </div>
      <div class="metric-card" id="s5-m2">
        <div class="metric-val" id="s5-v2">R$ 0</div>
        <div class="metric-label">Custo de atendimento</div>
      </div>
    </div>
    <div class="insight" id="s5-insight">💡 IA identificou: pico de vendas às 20h</div>`;
}

// ── CENA 6: Diferencial ───────────────────────────────────────────────────────
function scene6() {
  return `
    <p class="diff-sub" id="s6-sub">Diferente de outras soluções</p>
    <h1 class="diff-title" id="s6-h">
      <span class="word accent">Resultados</span>
      <span class="word">em dias,</span>
    </h1>
    <h2 class="diff-not" id="s6-not">não <span class="muted-cross">meses.</span></h2>
    <div class="rule center" id="s6-rule"></div>
    <div class="proof-row" id="s6-proof">
      <span class="proof-item" id="s6-p1">⚡ Setup rápido</span>
      <span class="proof-item" id="s6-p2">✅ Sem código</span>
      <span class="proof-item" id="s6-p3">🚀 ROI imediato</span>
    </div>`;
}

// ── CENA 7: CTA Final ─────────────────────────────────────────────────────────
function scene7() {
  return `
    <div class="cta-pre" id="s7-pre">COMECE AGORA</div>
    <div class="cta-brand-wrap" id="s7-brand">
      <div class="cta-glow" id="s7-glow"></div>
      <div class="cta-name">Centraliza<span class="accent">AI</span></div>
      <div class="cta-group">Group</div>
    </div>
    <div class="rule center" id="s7-rule"></div>
    <div class="cta-url mono" id="s7-url">🌐 centralizaaigroup.org/landing</div>
    <div class="cta-sub" id="s7-sub">Transforme sua empresa com IA</div>
    <div class="reg tl" id="s7-r1"></div><div class="reg br" id="s7-r2"></div>`;
}

const BODIES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7];

// ── ANIMAÇÕES ────────────────────────────────────────────────────────────────
function anim(i, t) {
  const L = [];
  const P = (s) => L.push(s);
  const at = (d) => round(t + d);

  P(`tl.fromTo("#scene-inner-${i}",{opacity:0},{opacity:1,duration:${FADE},ease:"power2.out"},${t});`);
  P(`tl.to("#scene-inner-${i}",{opacity:0,duration:${FADE},ease:"power2.in"},${round(S[i-1].end - FADE)});`);
  P(`tl.set("#scene-inner-${i}",{opacity:0},${round(S[i-1].end)});`);

  switch (i) {
    case 1:
      P(`tl.from("#s1-eyebrow",{y:-28,opacity:0,duration:.55,ease:"power3.out"},${at(0.1)});`);
      P(`tl.from("#s1-title .word",{y:80,opacity:0,duration:.65,stagger:.18,ease:"power4.out"},${at(0.3)});`);
      P(`tl.fromTo("#s1-rule",{scaleX:0},{scaleX:1,duration:.7,ease:"expo.out",transformOrigin:"left center"},${at(0.9)});`);
      P(`tl.from("#s1-sub",{y:24,opacity:0,duration:.6,ease:"power2.out"},${at(1.1)});`);
      P(`tl.from(["#s1-r1","#s1-r2"],{opacity:0,scale:.4,duration:.6,stagger:.12,ease:"back.out(2)"},${at(0.4)});`);
      break;
    case 2:
      P(`tl.from("#s2-logo",{scale:.3,opacity:0,duration:.8,ease:"back.out(2.0)"},${at(0.2)});`);
      P(`tl.fromTo("#s2-glow",{scale:.5,opacity:.8},{scale:1.8,opacity:0,duration:1.8,repeat:3,ease:"sine.out"},${at(0.4)});`);
      P(`tl.from("#s2-name",{y:36,opacity:0,duration:.6,ease:"power3.out"},${at(1.0)});`);
      P(`tl.fromTo("#s2-rule",{scaleX:0},{scaleX:1,duration:.65,ease:"expo.out",transformOrigin:"center center"},${at(1.5)});`);
      P(`tl.from("#s2-tag",{y:20,opacity:0,duration:.55,ease:"power2.out"},${at(1.8)});`);
      break;
    case 3:
      P(`tl.from("#s3-k",{y:-20,opacity:0,duration:.5,ease:"power2.out"},${at(0.1)});`);
      P(`tl.from("#s3-h",{y:40,opacity:0,duration:.6,ease:"power3.out"},${at(0.3)});`);
      P(`tl.from("#s3-m1",{x:-50,opacity:0,duration:.5,ease:"power3.out"},${at(1.0)});`);
      P(`tl.from("#s3-m2",{x:50,opacity:0,duration:.5,ease:"power3.out"},${at(1.8)});`);
      P(`tl.from("#s3-m3",{x:-50,opacity:0,duration:.5,ease:"power3.out"},${at(2.6)});`);
      P(`tl.from("#s3-badge",{y:20,opacity:0,duration:.5,ease:"back.out(1.6)"},${at(3.2)});`);
      break;
    case 4:
      P(`tl.from("#s4-k",{y:-20,opacity:0,duration:.5,ease:"power2.out"},${at(0.1)});`);
      P(`tl.from("#s4-h",{y:40,opacity:0,duration:.6,ease:"power3.out"},${at(0.3)});`);
      P(`tl.from(["#s4-f1","#s4-f2","#s4-f3"],{y:40,opacity:0,duration:.5,stagger:.25,ease:"back.out(1.5)"},${at(1.0)});`);
      P(`tl.fromTo("#s4-f3",{boxShadow:"0 0 0px rgba(255,195,0,0)"},{boxShadow:"0 0 40px rgba(255,195,0,.4)",duration:.8,repeat:3,yoyo:true,ease:"sine.inOut"},${at(2.5)});`);
      break;
    case 5:
      P(`tl.from("#s5-k",{y:-20,opacity:0,duration:.5,ease:"power2.out"},${at(0.1)});`);
      P(`tl.from("#s5-h",{y:40,opacity:0,duration:.6,ease:"power3.out"},${at(0.3)});`);
      P(`tl.from(["#s5-m1","#s5-m2"],{scale:.7,opacity:0,duration:.6,stagger:.2,ease:"back.out(1.8)"},${at(1.0)});`);
      P(`tl.fromTo("#s5-v1",{textContent:"0%"},{textContent:"+247%",duration:1.2,snap:{textContent:1},ease:"power2.out"},${at(1.2)});`);
      P(`tl.from("#s5-insight",{y:24,opacity:0,duration:.55,ease:"power2.out"},${at(2.5)});`);
      break;
    case 6:
      P(`tl.from("#s6-sub",{y:-20,opacity:0,duration:.5,ease:"power2.out"},${at(0.1)});`);
      P(`tl.from("#s6-h .word",{y:70,opacity:0,duration:.65,stagger:.2,ease:"power4.out"},${at(0.3)});`);
      P(`tl.from("#s6-not",{scale:.7,opacity:0,duration:.7,ease:"back.out(1.6)"},${at(1.0)});`);
      P(`tl.fromTo("#s6-rule",{scaleX:0},{scaleX:1,duration:.65,ease:"expo.out",transformOrigin:"center center"},${at(1.5)});`);
      P(`tl.from(["#s6-p1","#s6-p2","#s6-p3"],{y:24,opacity:0,duration:.5,stagger:.18,ease:"back.out(1.6)"},${at(1.8)});`);
      break;
    case 7:
      P(`tl.from("#s7-pre",{y:-24,opacity:0,duration:.5,ease:"power2.out"},${at(0.1)});`);
      P(`tl.from("#s7-brand",{scale:.6,opacity:0,duration:.8,ease:"back.out(1.8)"},${at(0.4)});`);
      P(`tl.fromTo("#s7-glow",{scale:.5,opacity:.9},{scale:2.2,opacity:0,duration:2,repeat:3,ease:"sine.out"},${at(0.5)});`);
      P(`tl.fromTo("#s7-rule",{scaleX:0},{scaleX:1,duration:.65,ease:"expo.out",transformOrigin:"center center"},${at(1.2)});`);
      P(`tl.from("#s7-url",{y:24,opacity:0,duration:.6,ease:"power2.out"},${at(1.4)});`);
      P(`tl.from("#s7-sub",{y:18,opacity:0,duration:.5,ease:"power2.out"},${at(1.9)});`);
      P(`tl.from(["#s7-r1","#s7-r2"],{opacity:0,scale:.4,duration:.6,stagger:.12,ease:"back.out(2)"},${at(0.5)});`);
      break;
  }
  P(`tl.fromTo("#cap-${i}",{opacity:0,y:14},{opacity:1,y:0,duration:.5,ease:"power2.out"},${at(0.35)});`);
  P(`tl.to("#cap-${i}",{opacity:0,duration:.4,ease:"power2.in"},${round(S[i-1].end - 0.55)});`);
  return L.join("\n      ");
}

// ── MONTAGEM HTML ────────────────────────────────────────────────────────────
const scenesHTML = S.map((s, idx) => `
    <section id="s${s.i}" class="scene clip" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${s.i % 2 === 1 ? 1 : 3}">
      <div class="scene-inner" id="scene-inner-${s.i}">${BODIES[idx]()}</div>
    </section>`).join("");

const captionsHTML = S.map((s, idx) => `
    <div class="caption clip" id="cap-${s.i}" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${s.i % 2 === 1 ? 2 : 4}">${CAPTIONS[idx]}</div>`).join("");

const audioHTML = S.map((s) => `
    <audio id="a${s.i}" data-start="${s.audioStart}" data-duration="${s.audioDur}" data-track-index="20" src="assets/audio/s${s.i}.wav"></audio>`).join("");

const animJS = S.map((s) => anim(s.i, s.start)).join("\n      ");

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      ${FONT_CSS}
      :root{
        --bg:#0D1321; --bg2:#1D2D44; --bg3:#3E5C76;
        --fg:#F0EBD8; --muted:#748CAB; --accent:#FFC300; --accent2:#FCA311; --code:#2EC4B6;
      }
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--bg);color:var(--fg);
        font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .mono{font-family:"JetBrains Mono",ui-monospace,monospace}
      #root{position:relative;width:${W}px;height:${H}px;overflow:hidden}

      /* background persistente */
      .bg-layer{position:absolute;inset:0;z-index:0;pointer-events:none}
      #glow{position:absolute;top:-200px;left:-160px;width:900px;height:900px;border-radius:50%;
        background:radial-gradient(circle,rgba(255,195,0,.22),rgba(255,195,0,0) 62%);filter:blur(8px)}
      #glow2{position:absolute;bottom:-300px;right:-200px;width:1000px;height:1000px;border-radius:50%;
        background:radial-gradient(circle,rgba(46,196,182,.12),rgba(46,196,182,0) 62%)}
      #grid{position:absolute;inset:-2px;opacity:.45;
        background-image:linear-gradient(rgba(116,140,171,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(116,140,171,.07) 1px,transparent 1px);
        background-size:54px 54px}
      .ghost{position:absolute;font-family:Sora,sans-serif;font-weight:800;color:rgba(255,195,0,.035);
        font-size:380px;line-height:.8;letter-spacing:-.03em;top:520px;left:-40px;white-space:nowrap;user-select:none}
      #grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
      #progress{position:absolute;left:0;bottom:0;height:6px;width:100%;transform:scaleX(0);transform-origin:left center;
        background:linear-gradient(90deg,var(--accent),var(--accent2));z-index:40;box-shadow:0 0 18px rgba(255,195,0,.5)}

      /* cena base */
      .scene{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;justify-content:center;
        padding:170px 70px 240px}
      .scene-inner{position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center}
      .accent{color:var(--accent)} .muted{color:var(--muted)} .dim{color:var(--muted)}

      /* elementos reutilizáveis */
      .eyebrow{display:inline-flex;align-items:center;gap:14px;font-family:"JetBrains Mono",monospace;
        font-size:22px;letter-spacing:.3em;color:var(--muted);font-weight:600;margin-bottom:24px}
      .eyebrow .dot{width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent);flex:none}
      .rule{height:6px;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:6px;margin:28px 0}
      .rule.center{width:280px;margin:28px auto}
      .reg{position:absolute;width:44px;height:44px;border:3px solid var(--bg3)}
      .reg.tl{top:0;left:0;border-right:none;border-bottom:none}
      .reg.br{bottom:0;right:0;border-left:none;border-top:none}

      /* cena 1 */
      .title{font-family:Sora,sans-serif;font-weight:800;font-size:104px;line-height:.98;letter-spacing:-.02em;margin:16px 0}
      .title .word{display:block}
      .subhead{font-size:36px;color:var(--muted);margin-top:8px}

      /* cena 2 */
      .brand-wrap{position:relative;display:flex;align-items:center;justify-content:center;margin:0 auto 32px;
        width:220px;height:220px}
      .brand-glow{position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(circle,rgba(255,195,0,.35),transparent 70%)}
      .brand-logo{width:200px;height:200px;border-radius:50%;background:linear-gradient(135deg,#1D2D44,#0D1321);
        border:3px solid var(--accent);display:flex;align-items:center;justify-content:center;
        font-family:Sora,sans-serif;font-weight:800;font-size:72px;letter-spacing:-.02em;
        box-shadow:0 0 60px rgba(255,195,0,.25)}
      .logo-c{color:var(--fg)}.logo-ai{color:var(--accent)}
      .brand-name{font-family:Sora,sans-serif;font-weight:800;font-size:72px;text-align:center;letter-spacing:-.02em;line-height:1}
      .brand-tagline{text-align:center;font-size:30px;color:var(--muted);margin-top:20px}

      /* cena 3 */
      .feat-kicker{display:flex;align-items:center;gap:18px;font-family:"JetBrains Mono",monospace;
        font-size:20px;letter-spacing:.28em;color:var(--accent);text-transform:uppercase;font-weight:700;margin-bottom:20px}
      .feat-num{font-size:48px;font-family:Sora;font-weight:800;color:rgba(255,195,0,.25);letter-spacing:-.02em;line-height:1}
      .feat-title{font-family:Sora,sans-serif;font-weight:800;font-size:78px;line-height:1.0;letter-spacing:-.02em;margin-bottom:28px}
      .chat-demo{display:flex;flex-direction:column;gap:16px;margin:0 0 24px}
      .chat-msg{display:flex;align-items:flex-start;gap:12px;padding:18px 22px;border-radius:16px;font-size:28px;line-height:1.4;max-width:88%}
      .chat-msg.bot{background:var(--bg2);border:2px solid var(--bg3);align-self:flex-start}
      .chat-msg.user{background:rgba(255,195,0,.12);border:2px solid rgba(255,195,0,.35);align-self:flex-end;color:var(--accent)}
      .chat-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none;margin-top:8px;box-shadow:0 0 10px var(--accent)}
      .feat-badge{display:inline-block;background:rgba(255,195,0,.12);border:2px solid var(--accent);
        border-radius:999px;padding:14px 28px;font-family:"JetBrains Mono",monospace;font-size:24px;color:var(--accent);font-weight:700}

      /* cena 4 */
      .funnel{display:flex;flex-direction:column;gap:8px;margin-top:16px}
      .f-step{display:flex;align-items:center;gap:20px;background:var(--bg2);border:2px solid var(--bg3);
        border-radius:16px;padding:22px 28px;font-size:32px;color:var(--fg)}
      .f-step.accent-step{background:rgba(255,195,0,.1);border-color:var(--accent);color:var(--accent)}
      .f-icon{font-size:36px;flex:none}
      .f-label{flex:1;font-weight:600}
      .f-arrow{color:var(--accent);font-size:28px;font-weight:700}

      /* cena 5 */
      .metrics{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}
      .metric-card{background:var(--bg2);border:2px solid var(--bg3);border-radius:20px;padding:32px 24px;text-align:center}
      .metric-val{font-family:Sora;font-weight:800;font-size:64px;letter-spacing:-.02em;color:var(--fg)}
      .metric-val.accent{color:var(--accent)}
      .metric-label{font-size:24px;color:var(--muted);margin-top:8px}
      .insight{background:rgba(255,195,0,.08);border:2px solid rgba(255,195,0,.3);border-radius:14px;
        padding:18px 24px;font-size:28px;color:var(--fg)}

      /* cena 6 */
      .diff-sub{font-size:28px;color:var(--muted);margin-bottom:16px}
      .diff-title{font-family:Sora,sans-serif;font-weight:800;font-size:110px;line-height:.95;letter-spacing:-.03em}
      .diff-title .word{display:block}
      .diff-not{font-family:Sora,sans-serif;font-weight:800;font-size:90px;letter-spacing:-.02em;color:var(--fg);margin-top:8px}
      .muted-cross{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--accent)}
      .proof-row{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
      .proof-item{background:rgba(46,196,182,.1);border:2px solid rgba(46,196,182,.3);border-radius:999px;
        padding:14px 24px;font-size:28px;font-weight:600;color:var(--code)}

      /* cena 7 CTA */
      .cta-pre{text-align:center;font-family:"JetBrains Mono",monospace;font-size:24px;letter-spacing:.36em;
        color:var(--muted);text-transform:uppercase;margin-bottom:28px}
      .cta-brand-wrap{position:relative;text-align:center;margin-bottom:8px}
      .cta-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,195,0,.2),transparent 70%)}
      .cta-name{font-family:Sora,sans-serif;font-weight:800;font-size:110px;letter-spacing:-.03em;line-height:.95;position:relative}
      .cta-group{font-family:Sora,sans-serif;font-weight:700;font-size:52px;color:var(--muted);position:relative}
      .cta-url{display:flex;align-items:center;justify-content:center;gap:14px;font-size:30px;color:var(--fg);
        margin-top:24px;background:var(--bg2);border:2px solid var(--bg3);border-radius:14px;padding:20px 28px}
      .cta-sub{text-align:center;font-size:30px;color:var(--muted);margin-top:20px}

      /* caption */
      .caption{position:absolute;left:50%;transform:translateX(-50%);bottom:150px;z-index:30;
        max-width:940px;text-align:center;font-size:30px;font-weight:600;color:var(--fg);
        background:rgba(10,18,30,.75);border:1px solid var(--bg3);border-radius:14px;padding:16px 32px;
        backdrop-filter:blur(6px)}
    </style>
  </head>
  <body class="v">
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
      <div class="bg-layer" data-layout-ignore>
        <div id="glow"></div><div id="glow2"></div><div id="grid"></div>
        <div class="ghost" data-layout-ignore>AI</div>
        <div id="grain"></div>
      </div>
${scenesHTML}
${captionsHTML}
      <div id="progress"></div>
${audioHTML}
      <script>
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });
        const TOTAL = ${TOTAL};
        tl.to("#glow",{scale:1.25,opacity:.6,duration:4.5,yoyo:true,repeat:Math.ceil(TOTAL/4.5)+1,ease:"sine.inOut"},0);
        tl.to("#glow2",{scale:1.2,duration:6,yoyo:true,repeat:Math.ceil(TOTAL/6)+1,ease:"sine.inOut"},0);
        tl.to(".ghost",{x:140,duration:TOTAL,ease:"none"},0);
        tl.to("#grid",{backgroundPositionX:"+=108",backgroundPositionY:"+=108",duration:18,repeat:Math.ceil(TOTAL/18)+1,ease:"none"},0);
        tl.fromTo("#progress",{scaleX:0},{scaleX:1,duration:TOTAL,ease:"none"},0);
      ${animJS}
        tl.set({}, {}, TOTAL);
        window.__timelines["main"] = tl;
      </script>
    </div>
  </body>
</html>
`;

writeFileSync(new URL("./" + OUT, import.meta.url), html);
console.log(`${OUT} gerado · ${W}x${H} · TOTAL = ${TOTAL}s · ${S.length} cenas`);
S.forEach(s => console.log(`  s${s.i}: start=${s.start} dur=${s.dur} audio@${s.audioStart} (${s.audioDur}s)`));
