// Kuim: o jogo que os comentários do kuimenso constroem.
// Mundo infinito para a direita, gerado em blocos. Cada episódio acrescenta algo aqui.
(() => {
  'use strict';
  const W = 540, H = 960;
  const tela = document.getElementById('tela');
  const g = tela.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo');            // ?demo=1: o bot joga sozinho (usado para gravar o vídeo)
  const SEMENTE = Number(params.get('seed') || (DEMO ? 7 : Date.now() % 100000));

  // ---------------------------------------------------------------- aleatório com semente
  let s = SEMENTE >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const entre = (a, b) => a + rnd() * (b - a);

  // ---------------------------------------------------------------- constantes de física
  const GRAV = 2200, PULO = 980, VEL = 330, CHAO = 760, BLOCO = 540;

  // ---------------------------------------------------------------- mundo
  const plataformas = []; // {x, y, w}
  const moedas = [];      // {x, y, pega}
  let fimGerado = 0;
  function gerarBloco() {
    const x0 = fimGerado;
    // chão com buraco às vezes (nunca no 1º bloco)
    if (x0 > 0 && rnd() < 0.45) {
      const buraco = entre(90, 150), ini = entre(120, BLOCO - buraco - 60);
      plataformas.push({x: x0, y: CHAO, w: ini, chao: true});
      plataformas.push({x: x0 + ini + buraco, y: CHAO, w: BLOCO - ini - buraco, chao: true});
    } else {
      plataformas.push({x: x0, y: CHAO, w: BLOCO, chao: true});
    }
    // plataformas flutuantes com moedas
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const w = entre(110, 170), x = x0 + entre(30, BLOCO - w - 30), y = CHAO - entre(150, 300);
      plataformas.push({x, y, w});
      for (let k = 0; k < 3; k++) moedas.push({x: x + w / 2 + (k - 1) * 34, y: y - 45, pega: false});
    }
    for (let k = 0; k < 2; k++) moedas.push({x: x0 + entre(60, BLOCO - 60), y: CHAO - 50, pega: false});
    fimGerado += BLOCO;
  }
  for (let i = 0; i < 4; i++) gerarBloco();

  // ---------------------------------------------------------------- jogador
  const kuim = {x: 120, y: CHAO - 60, vx: 0, vy: 0, r: 30, noChao: false, olhar: 1, piscar: 0, esticar: 0};
  let moedasPegas = 0, cam = 0, tempo = 0;
  const particulas = [];

  // ---------------------------------------------------------------- controles
  const tecla = {esq: false, dir: false, pulo: false};
  let puloPedido = false;
  addEventListener('keydown', e => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) tecla.esq = true;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) tecla.dir = true;
    if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) { if (!tecla.pulo) puloPedido = true; tecla.pulo = true; e.preventDefault(); }
  });
  addEventListener('keyup', e => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) tecla.esq = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) tecla.dir = false;
    if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) tecla.pulo = false;
  });
  const botao = (id, nome) => {
    const b = document.getElementById(id);
    const on = e => { e.preventDefault(); if (nome === 'pulo' && !tecla.pulo) puloPedido = true; tecla[nome] = true; b.classList.add('on'); };
    const off = e => { e.preventDefault(); tecla[nome] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  };
  botao('esq', 'esq'); botao('dir', 'dir'); botao('pulo', 'pulo');

  // ---------------------------------------------------------------- bot do modo demo
  function bot() {
    tecla.dir = true; tecla.esq = false;
    const chaoEm = fx => plataformas.some(p => p.chao && fx > p.x && fx < p.x + p.w);
    const temChao = chaoEm(kuim.x + 45) && chaoEm(kuim.x + 85);
    const alvo = plataformas.find(p => !p.chao && p.x > kuim.x + 40 && p.x < kuim.x + 190 && p.y < kuim.y);
    if (kuim.noChao && (!temChao || (alvo && rnd() < 0.08))) puloPedido = true;
  }

  // ---------------------------------------------------------------- atualização
  function atualizar(dt) {
    tempo += dt;
    if (DEMO) bot();
    const dirx = (tecla.dir ? 1 : 0) - (tecla.esq ? 1 : 0);
    kuim.vx += (dirx * VEL - kuim.vx) * Math.min(1, dt * 12);
    if (dirx) kuim.olhar = dirx;
    if (puloPedido && kuim.noChao) { kuim.vy = -PULO; kuim.noChao = false; kuim.esticar = 1; poeira(kuim.x, kuim.y + kuim.r, 6); }
    puloPedido = false;
    if (!tecla.pulo && kuim.vy < -300) kuim.vy += GRAV * dt; // pulo mais curto se soltar o botão
    kuim.vy += GRAV * dt;
    const yAntes = kuim.y;
    kuim.x += kuim.vx * dt; kuim.y += kuim.vy * dt;
    if (kuim.x < cam + kuim.r) { kuim.x = cam + kuim.r; kuim.vx = 0; }

    // colisão por cima das plataformas
    const estavaNoChao = kuim.noChao; kuim.noChao = false;
    for (const p of plataformas) {
      if (kuim.x > p.x - 6 && kuim.x < p.x + p.w + 6 && kuim.vy >= 0 && yAntes + kuim.r <= p.y + 2 && kuim.y + kuim.r >= p.y) {
        kuim.y = p.y - kuim.r; kuim.vy = 0; kuim.noChao = true;
        if (!estavaNoChao) { kuim.esticar = -1; poeira(kuim.x, p.y, 8); }
      }
    }
    kuim.esticar *= Math.pow(0.002, dt);

    // caiu no buraco: volta um pouco atrás
    if (kuim.y > H + 100) {
      const seguro = plataformas.filter(p => p.chao && p.x + p.w < kuim.x - 40).pop() || plataformas[0];
      kuim.x = Math.max(seguro.x + 40, cam + 80); kuim.y = CHAO - 300; kuim.vy = 0;
    }

    for (const m of moedas) {
      if (!m.pega && Math.hypot(m.x - kuim.x, m.y - kuim.y) < kuim.r + 16) {
        m.pega = true; moedasPegas++; document.getElementById('moedas').textContent = moedasPegas; brilho(m.x, m.y);
      }
    }
    for (const p of particulas) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt * p.g; p.vida -= dt; }
    for (let i = particulas.length - 1; i >= 0; i--) if (particulas[i].vida <= 0) particulas.splice(i, 1);

    // câmera segue o Kuim e o mundo nunca acaba
    cam += (Math.max(0, kuim.x - W * 0.35) - cam) * Math.min(1, dt * 6);
    while (fimGerado < cam + W * 2) gerarBloco();
    kuim.piscar -= dt; if (kuim.piscar < -3) kuim.piscar = 0.12;
  }
  function poeira(x, y, n) { for (let i = 0; i < n; i++) particulas.push({x, y, vx: entre(-120, 120), vy: entre(-160, -40), vida: 0.4, g: 1, cor: '#c9b8ff', t: 4}); }
  function brilho(x, y) { for (let i = 0; i < 10; i++) { const a = rnd() * 6.28; particulas.push({x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, vida: 0.35, g: 0, cor: '#ffd84d', t: 5}); } }

  // ---------------------------------------------------------------- desenho
  function fundo() {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2a1458'); gr.addColorStop(0.6, '#5b2a86'); gr.addColorStop(1, '#ff6fa8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // estrelas e montanhas em paralaxe
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 40; i++) { const x = ((i * 137 - cam * 0.05) % W + W) % W, y = (i * 71) % 420; g.fillRect(x, y, 2, 2); }
    for (const [vel, cor, alt] of [[0.15, '#3d1d6e', 330], [0.35, '#2b1450', 230]]) {
      g.fillStyle = cor; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 30) { const wx = x + cam * vel; g.lineTo(x, CHAO - alt * 0.4 - Math.sin(wx * 0.006) * 60 - Math.sin(wx * 0.017) * 25); }
      g.lineTo(W, H); g.fill();
    }
  }
  function desenharKuim() {
    const {x, y, r} = kuim, e = kuim.esticar;
    g.save(); g.translate(x - cam, y); g.scale(1 - e * 0.18, 1 + e * 0.22);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, r + 4, r * 0.9, 6, 0, 0, 7); g.fill();
    // corpo de controle (gamepad redondinho)
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.ellipse(0, 0, r * 1.25, r, 0, 0, 7); g.fill();
    g.fillStyle = '#ff8cbb'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.45, r * 0.5, r * 0.22, -0.3, 0, 7); g.fill();
    // botõezinhos nas costas
    g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(-kuim.olhar * r * 0.85, r * 0.15, 5, 0, 7); g.fill();
    g.fillStyle = '#4dd2ff'; g.beginPath(); g.arc(-kuim.olhar * r * 0.65, r * 0.4, 5, 0, 7); g.fill();
    // olhos
    const ox = kuim.olhar * r * 0.28, fecha = kuim.piscar > 0;
    for (const dx of [-11, 11]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ox + dx, -4, 8, fecha ? 1.5 : 10, 0, 0, 7); g.fill();
      if (!fecha) { g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(ox + dx + kuim.olhar * 3, -2, 4.5, 0, 7); g.fill(); }
    }
    // pezinhos
    g.fillStyle = '#c21d63'; const passo = kuim.noChao ? Math.sin(tempo * 18) * Math.min(1, Math.abs(kuim.vx) / VEL) * 6 : 0;
    g.beginPath(); g.ellipse(-12, r - 2 + passo, 9, 6, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(12, r - 2 - passo, 9, 6, 0, 0, 7); g.fill();
    g.restore();
  }
  function desenhar() {
    fundo();
    for (const p of plataformas) {
      const x = p.x - cam; if (x > W || x + p.w < 0) continue;
      if (p.chao) {
        g.fillStyle = '#1b0f33'; g.fillRect(x, p.y, p.w, H - p.y);
        g.fillStyle = '#7cff9b'; g.fillRect(x, p.y, p.w, 14);
        g.fillStyle = '#3fbf68'; for (let k = 6; k < p.w; k += 22) g.fillRect(x + k, p.y + 14, 10, 6);
      } else {
        g.fillStyle = '#ffd84d'; g.beginPath(); g.roundRect(x, p.y, p.w, 22, 11); g.fill();
        g.fillStyle = '#e0a800'; g.fillRect(x + 10, p.y + 16, p.w - 20, 6);
      }
    }
    for (const m of moedas) {
      if (m.pega) continue; const x = m.x - cam; if (x < -20 || x > W + 20) continue;
      const larg = Math.abs(Math.cos(tempo * 4 + m.x * 0.01)) * 13 + 2, flut = Math.sin(tempo * 3 + m.x) * 4;
      g.fillStyle = '#ffd84d'; g.beginPath(); g.ellipse(x, m.y + flut, larg, 15, 0, 0, 7); g.fill();
      g.fillStyle = '#fff3b0'; g.beginPath(); g.ellipse(x - larg * 0.3, m.y + flut - 4, larg * 0.3, 5, 0, 0, 7); g.fill();
    }
    for (const p of particulas) { g.globalAlpha = Math.max(0, p.vida * 2.5); g.fillStyle = p.cor; g.fillRect(p.x - cam, p.y, p.t, p.t); }
    g.globalAlpha = 1;
    desenharKuim();
    // chamada para comentar (fica no jogo e aparece no vídeo)
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(30, 800, W - 60, 46, 14); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 20px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Comenta no vídeo o que o Kuim ganha amanhã', W / 2, 830);
  }

  // ---------------------------------------------------------------- laço
  let antes = performance.now();
  function quadro(agora) {
    const dt = Math.min(0.033, (agora - antes) / 1000); antes = agora;
    atualizar(dt); desenhar(); requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  // ---------------------------------------------------------------- episódios
  const eps = window.EPISODIOS || [];
  const ultimo = eps[eps.length - 1];
  document.getElementById('dia').textContent = ultimo ? `DIA ${ultimo.dia} · ${ultimo.titulo}` : 'DIA 0';
  const lista = document.getElementById('lista');
  for (const ep of [...eps].reverse()) {
    const li = document.createElement('li'); li.value = ep.dia;
    const b = document.createElement('b'); b.textContent = ep.titulo + ': ';
    const t = document.createElement('span'); t.textContent = ep.mudanca;
    const q = document.createElement('div'); q.className = 'quem'; q.textContent = `ideia de @${ep.ideia} · ${ep.data}`;
    li.append(b, t, q); lista.append(li);
  }
  const painel = document.getElementById('painel'), cofre = document.getElementById('cofre');
  document.getElementById('btnEp').onclick = () => { painel.hidden = false; };
  document.getElementById('btnCofre').onclick = () => { cofre.hidden = false; abrirCofre(); };
  document.querySelectorAll('.fechar').forEach(b => { b.onclick = () => { painel.hidden = true; cofre.hidden = true; }; });

  // ---------------------------------------------------------------- cofre transparente (LivePix, só leitura)
  const reais = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  const item = (lista, texto, sub) => { const li = document.createElement('li'); li.textContent = texto; if (sub) { const d = document.createElement('div'); d.className = 'quem'; d.textContent = sub; li.append(d); } lista.append(li); };
  async function abrirCofre() {
    const gastos = window.GASTOS || [], totalGasto = gastos.reduce((s, x) => s + x.valor, 0);
    document.getElementById('cGasto').textContent = reais(totalGasto);
    const lg = document.getElementById('cGastos'); lg.textContent = '';
    if (!gastos.length) item(lg, 'Nenhum gasto ainda.');
    for (const x of gastos) item(lg, `${reais(x.valor)}: ${x.oque}`, x.data);
    const pix = document.getElementById('cPix');
    if (window.LIVEPIX_URL) { pix.href = window.LIVEPIX_URL; pix.hidden = false; }
    const st = document.getElementById('cofreStatus');
    try {
      const d = await fetch('/api/cofre').then(r => r.json());
      if (!d.ativo) { st.textContent = d.aviso || 'Cofre ainda não conectado.'; return; }
      st.textContent = 'Atualizado: ' + new Date(d.atualizado).toLocaleString('pt-BR');
      document.getElementById('cSaldo').textContent = reais(d.saldo);
      document.getElementById('cTotal').textContent = reais(d.totalRecebidoListado);
      const la = document.getElementById('cApoios'); la.textContent = '';
      if (!d.apoios.length) item(la, 'Ninguém apoiou ainda. Seja o primeiro!');
      for (const a of d.apoios.slice(0, 20)) item(la, `${a.nome}: ${reais(a.valor)}`, a.msg);
    } catch (e) { st.textContent = 'Não deu para ler o cofre agora.'; }
  }
  if (DEMO) document.getElementById('controles').style.display = 'none';
})();
