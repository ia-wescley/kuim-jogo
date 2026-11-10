// Kuim: o jogo que os comentários do kuimenso constroem.
// Mundo infinito para a direita, gerado em blocos. Cada episódio acrescenta algo aqui.
// Dia 1 (10/11/2026): passagem secreta com arma (@Vitin-d6w), chefão de 550 de vida + espada e escudo
// (@OtseniOfical, com o boss de @lovepets5492: moeda deixa a espada mais forte) e o desafio "chão é lava" (@Arthurwicthoff).
(() => {
  'use strict';
  const W = 540, H = 960;
  const tela = document.getElementById('tela');
  const g = tela.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo');            // ?demo=1: o bot joga sozinho (usado para gravar o vídeo)
  const IR = params.get('ir') || '';          // atalho para gravar: parede | lava | chefe
  const SEMENTE = Number(params.get('seed') || (DEMO ? 7 : Date.now() % 100000));

  // ---------------------------------------------------------------- aleatório com semente
  let s = SEMENTE >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const entre = (a, b) => a + rnd() * (b - a);

  // ---------------------------------------------------------------- constantes de física
  const GRAV = 2200, PULO = 980, VEL = 330, CHAO = 760, BLOCO = 540;
  const PILAR_W = 100, PILAR_H = 110;
  const DESAFIO_SEG = 60, DESAFIO_PREMIO = 250;
  const CHEFE_VIDA = 550;

  // ---------------------------------------------------------------- mundo
  const plataformas = []; // {x, y, w, chao?, lava?, pilar?, segredo?}
  const moedas = [];      // {x, y, pega}
  const itens = [];       // {x, y, tipo: 'arma'|'espada', pego}
  let fimGerado = 0, blocoN = 0, geraModo = 'normal';
  const BLOCO_SEGREDO = IR === 'parede' ? 3 : 4 + Math.floor(rnd() * 4);
  const BLOCO_PLACA = IR === 'lava' ? 2 : IR ? -1 : 11;
  const pendente = IR === 'chefe' ? ['pedestal', 'arena', 'arena'] : [];
  let desafio = null;     // {x, estado: espera|escolha|ativo|feito|falhou|passou, t}
  let chefe = null;

  const chaoCheio = (x0, extra = {}) => plataformas.push({x: x0, y: CHAO, w: BLOCO, chao: true, ...extra});
  const moedaChao = (x) => {
    const pil = plataformas.find(p => p.pilar && x > p.x - 20 && x < p.x + p.w + 20);
    moedas.push({x, y: pil ? pil.y - 45 : CHAO - 50, pega: false});
  };
  function flutuantes(x0) {
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const w = entre(110, 170), x = x0 + entre(30, BLOCO - w - 30), y = CHAO - entre(170, 300);
      plataformas.push({x, y, w});
      for (let k = 0; k < 3; k++) moedas.push({x: x + w / 2 + (k - 1) * 34, y: y - 45, pega: false});
    }
  }
  function gerarBloco() {
    const x0 = fimGerado, idx = blocoN++;
    fimGerado += BLOCO;
    if (pendente.length) {
      const t = pendente.shift();
      chaoCheio(x0);
      if (t === 'pedestal') { itens.push({x: x0 + 270, y: CHAO - 70, tipo: 'espada', pego: false}); moedaChao(x0 + 120); moedaChao(x0 + 420); }
      if (t === 'arena' && !chefe) {
        const ini = x0 + 270;
        chefe = {arenaIni: ini, x: ini + 420, y: CHAO - 80, r: 80, vx: 0, vy: 0, vida: CHEFE_VIDA, ativo: false, morto: false, t: 1.2, flash: 0, noChao: true, esticar: 0};
      }
      return;
    }
    if (geraModo === 'lava') {
      // chão inteiro de lava e só plataformas amarelas
      chaoCheio(x0, {lava: true});
      for (let k = 0; k < 2; k++) {
        const x = x0 + 20 + k * 270, y = CHAO - (k ? 100 : 80);
        plataformas.push({x, y, w: 160});
        moedas.push({x: x + 50, y: y - 45, pega: false}, {x: x + 110, y: y - 45, pega: false});
      }
      return;
    }
    if (idx === BLOCO_PLACA) {
      chaoCheio(x0);
      desafio = {x: x0 + 300, estado: 'espera', t: DESAFIO_SEG, escolhaT: 0};
      moedaChao(x0 + 120);
      return;
    }
    if (idx === BLOCO_SEGREDO) {
      // parede falsa: igual às outras, mas dá para atravessar. Dentro tem a arma e o nome de quem pediu.
      chaoCheio(x0);
      const px = x0 + 250;
      plataformas.push({x: px, y: CHAO - PILAR_H, w: PILAR_W, pilar: true, segredo: true});
      itens.push({x: px + PILAR_W / 2, y: CHAO - 40, tipo: 'arma', pego: false});
      flutuantes(x0);
      moedaChao(x0 + 80); moedaChao(x0 + 460);
      return;
    }
    // bloco normal: chão com buraco às vezes (nunca no 1º bloco) ou com um pilar no caminho
    if (x0 > 0 && rnd() < 0.45) {
      const buraco = entre(90, 150), ini = entre(120, BLOCO - buraco - 60);
      plataformas.push({x: x0, y: CHAO, w: ini, chao: true});
      plataformas.push({x: x0 + ini + buraco, y: CHAO, w: BLOCO - ini - buraco, chao: true});
    } else {
      chaoCheio(x0);
      if (x0 > 0 && rnd() < 0.5) plataformas.push({x: x0 + entre(150, BLOCO - 250), y: CHAO - PILAR_H, w: PILAR_W, pilar: true});
    }
    flutuantes(x0);
    for (let k = 0; k < 2; k++) moedaChao(x0 + entre(60, BLOCO - 60));
  }
  function cortarMundo(X) {
    for (let i = plataformas.length - 1; i >= 0; i--) {
      const p = plataformas[i];
      if (p.x >= X || (p.pilar && p.x + p.w > X)) plataformas.splice(i, 1);
      else if (p.chao && p.x + p.w > X) p.w = X - p.x;
    }
    for (let i = moedas.length - 1; i >= 0; i--) if (moedas[i].x >= X) moedas.splice(i, 1);
    for (let i = itens.length - 1; i >= 0; i--) if (itens[i].x >= X) itens.splice(i, 1);
    fimGerado = X;
  }
  for (let i = 0; i < 4; i++) gerarBloco();

  // ---------------------------------------------------------------- jogador
  const kuim = {x: 120, y: CHAO - 60, vx: 0, vy: 0, kb: 0, r: 30, noChao: false, olhar: 1, piscar: 0, esticar: 0, golpe: 0, inv: 0};
  let moedasPegas = 0, cam = 0, tempo = 0, balas = IR === 'chefe' && DEMO ? 20 : 0, temEspada = false, escudoT = 0, tremor = 0;
  const particulas = [], tiros = [], avisos = [], numeros = [];
  const placar = document.getElementById('moedas');
  const somaMoedas = n => { moedasPegas = Math.max(0, moedasPegas + n); placar.textContent = moedasPegas; };
  const aviso = (txt, cor = '#ffd84d', sub = '') => { avisos.length = 0; avisos.push({txt, sub, cor, t: 2.4}); };

  // ---------------------------------------------------------------- controles
  const tecla = {esq: false, dir: false, pulo: false, atk: false};
  let puloPedido = false, ataquePedido = false;
  addEventListener('keydown', e => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) tecla.esq = true;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) tecla.dir = true;
    if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) { if (!tecla.pulo) puloPedido = true; tecla.pulo = true; e.preventDefault(); }
    if (['j', 'J', 'x', 'X', 'f', 'F', 'Enter'].includes(e.key)) { if (!tecla.atk) ataquePedido = true; tecla.atk = true; }
  });
  addEventListener('keyup', e => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) tecla.esq = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) tecla.dir = false;
    if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) tecla.pulo = false;
    if (['j', 'J', 'x', 'X', 'f', 'F', 'Enter'].includes(e.key)) tecla.atk = false;
  });
  const botao = (id, nome) => {
    const b = document.getElementById(id); if (!b) return;
    const on = e => { e.preventDefault(); if (nome === 'pulo' && !tecla.pulo) puloPedido = true; if (nome === 'atk' && !tecla.atk) ataquePedido = true; tecla[nome] = true; b.classList.add('on'); };
    const off = e => { e.preventDefault(); tecla[nome] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  };
  botao('esq', 'esq'); botao('dir', 'dir'); botao('pulo', 'pulo'); botao('atk', 'atk');
  tela.addEventListener('pointerdown', e => {
    if (!desafio || desafio.estado !== 'escolha') return;
    const r = tela.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
    if (x < W / 2) passarDesafio(); else encararDesafio();
  });

  // ---------------------------------------------------------------- desafio "chão é lava" (ideia de @Arthurwicthoff)
  function encararDesafio() {
    desafio.estado = 'ativo'; desafio.t = DESAFIO_SEG;
    cortarMundo(Math.round(kuim.x + 150)); geraModo = 'lava';
    aviso('CHÃO É LAVA!', '#ff5a1f', 'só nas plataformas amarelas');
  }
  function passarDesafio() {
    desafio.estado = 'passou';
    aviso('Arregou, né?', '#c9b8ff');
    depoisDoDesafio();
  }
  function depoisDoDesafio() {
    geraModo = 'normal';
    for (const p of plataformas) p.lava = false; // a lava esfria
    const X = Math.round(cam + W + 60);
    if (X < fimGerado) cortarMundo(X);
    pendente.push('pedestal', 'arena', 'arena');
  }

  // ---------------------------------------------------------------- bot do modo demo
  let botPulo = 0, botEscolha = 0, botParado = 0;
  function bot(dt) {
    if (botParado > 0) { botParado -= dt; tecla.dir = false; tecla.esq = false; return; }
    if (desafio && desafio.estado === 'escolha') { botEscolha += dt; if (botEscolha > 1.5) encararDesafio(); return; }
    tecla.esq = false; tecla.dir = true;
    if (botPulo > 0) { botPulo -= dt; tecla.pulo = true; } else tecla.pulo = false;
    if (chefe && chefe.ativo && !chefe.morto) {
      const d = chefe.x - kuim.x, dist = Math.abs(d);
      tecla.dir = d > 0 && dist > 115; tecla.esq = d < 0 && dist > 115;
      kuim.olhar = Math.sign(d) || 1;
      if (balas > 0 ? rnd() < 0.25 : (dist < 130 && kuim.golpe <= 0)) ataquePedido = true;
      if (kuim.noChao && !chefe.noChao && dist < 220 && rnd() < 0.05) puloPedido = true;
      return;
    }
    if (!kuim.noChao) return;
    const sob = plataformas.find(p => !p.chao && !p.pilar && kuim.x > p.x - 6 && kuim.x < p.x + p.w + 6 && Math.abs(kuim.y + kuim.r - p.y) < 3);
    if (desafio && desafio.estado === 'ativo') {
      // simula o pulo curto e só pula quando vai cair no meio da próxima plataforma
      const prox = plataformas.filter(p => !p.chao && !p.pilar && p !== sob && p.x > kuim.x + 10).sort((a, b) => a.x - b.x)[0];
      if (prox && pousoDoPulo(prox.y) >= prox.x + 50) puloPedido = true;
      return;
    }
    const chaoEm = fx => plataformas.some(p => p.chao && fx > p.x && fx < p.x + p.w);
    const temChao = chaoEm(kuim.x + 45) && chaoEm(kuim.x + 85);
    const pilar = plataformas.find(p => p.pilar && !p.segredo && p.x > kuim.x && p.x - kuim.x < 90);
    if (pilar && !sob) { puloPedido = true; botPulo = 0.45; return; }
    const alvo = plataformas.find(p => !p.chao && !p.pilar && p.x > kuim.x + 40 && p.x < kuim.x + 190 && p.y < kuim.y);
    if (!temChao || (alvo && rnd() < 0.08)) { puloPedido = true; if (!temChao) botPulo = 0.3; }
  }

  function pousoDoPulo(alvoY) {
    let x = kuim.x, y = kuim.y, vy = -PULO; const d = 1 / 60;
    for (let i = 0; i < 120; i++) {
      if (vy < -300) vy += GRAV * d;
      vy += GRAV * d; y += vy * d; x += VEL * d;
      if (vy > 0 && y + kuim.r >= alvoY) return x;
    }
    return x;
  }

  // ---------------------------------------------------------------- atualização
  function atualizar(dt) {
    tempo += dt;
    for (const a of avisos) a.t -= dt;
    if (avisos.length && avisos[0].t <= 0) avisos.shift();
    if (DEMO) bot(dt);
    if (desafio && desafio.estado === 'espera' && kuim.x >= desafio.x) {
      desafio.estado = 'escolha'; puloPedido = false; kuim.vx = 0;
    }
    if (desafio && desafio.estado === 'escolha') {
      if (puloPedido) encararDesafio(); else if (tecla.esq) passarDesafio();
      puloPedido = false; return; // jogo pausado esperando a escolha
    }

    const dirx = (tecla.dir ? 1 : 0) - (tecla.esq ? 1 : 0);
    kuim.vx += (dirx * VEL - kuim.vx) * Math.min(1, dt * 12);
    if (dirx && !(DEMO && chefe && chefe.ativo && !chefe.morto)) kuim.olhar = dirx;
    if (puloPedido && kuim.noChao) { kuim.vy = -PULO; kuim.noChao = false; kuim.esticar = 1; poeira(kuim.x, kuim.y + kuim.r, 6); }
    puloPedido = false;
    if (!tecla.pulo && kuim.vy < -300) kuim.vy += GRAV * dt; // pulo mais curto se soltar o botão
    kuim.vy += GRAV * dt;
    const yAntes = kuim.y;
    kuim.x += (kuim.vx + kuim.kb) * dt; kuim.y += kuim.vy * dt;
    kuim.kb *= Math.pow(0.02, dt);
    if (kuim.x < cam + kuim.r) { kuim.x = cam + kuim.r; kuim.vx = 0; }
    if (chefe && chefe.ativo && !chefe.morto) kuim.x = Math.min(Math.max(kuim.x, chefe.arenaIni + kuim.r), chefe.arenaIni + W - kuim.r);

    // colisão por cima das plataformas
    const estavaNoChao = kuim.noChao; kuim.noChao = false;
    for (const p of plataformas) {
      if (kuim.x > p.x - 6 && kuim.x < p.x + p.w + 6 && kuim.vy >= 0 && yAntes + kuim.r <= p.y + 2 && kuim.y + kuim.r >= p.y) {
        kuim.y = p.y - kuim.r; kuim.vy = 0; kuim.noChao = true;
        if (!estavaNoChao) { kuim.esticar = -1; poeira(kuim.x, p.y, 8); }
        if (p.lava && desafio && desafio.estado === 'ativo') queimou();
      }
    }
    // lados dos pilares (a parede falsa deixa passar)
    for (const p of plataformas) {
      if (p.segredo && !p.achado && kuim.x > p.x + 10 && kuim.x < p.x + p.w - 10 && kuim.y > p.y) { p.achado = true; botParado = 1.6; }
      if (!p.pilar || p.segredo) continue;
      if (kuim.y + kuim.r > p.y + 6 && kuim.x + kuim.r > p.x && kuim.x - kuim.r < p.x + p.w) {
        kuim.x = kuim.x < p.x + p.w / 2 ? p.x - kuim.r : p.x + p.w + kuim.r; kuim.vx = 0; kuim.kb = 0;
      }
    }
    kuim.esticar *= Math.pow(0.002, dt);

    // caiu no buraco: volta um pouco atrás
    if (kuim.y > H + 100) {
      const seguro = plataformas.filter(p => p.chao && p.x + p.w < kuim.x - 40).pop() || plataformas[0];
      kuim.x = Math.max(seguro.x + 40, cam + 80); kuim.y = CHAO - 300; kuim.vy = 0;
    }

    for (const m of moedas) {
      if (!m.pega && Math.hypot(m.x - kuim.x, m.y - kuim.y) < kuim.r + 16) { m.pega = true; somaMoedas(1); brilho(m.x, m.y, '#ffd84d'); }
    }
    for (const it of itens) {
      if (it.pego || Math.abs(it.x - kuim.x) > 40 || Math.abs(it.y - kuim.y) > 60) continue;
      it.pego = true; brilho(it.x, it.y, '#7cff9b');
      if (it.tipo === 'arma') { balas = 20; aviso('PASSAGEM SECRETA!', '#7cff9b', 'arma com 20 balas'); }
      if (it.tipo === 'espada') { temEspada = true; escudoT = 0; aviso('ESPADA + ESCUDO', '#4dd2ff', 'aperta ⚔ pra bater'); }
    }

    // ataque: atira se tiver bala, senão espadada
    kuim.golpe -= dt; kuim.inv -= dt; escudoT -= dt;
    if (ataquePedido) {
      if (balas > 0) { balas--; tiros.push({x: kuim.x + kuim.olhar * 34, y: kuim.y - 4, vx: kuim.olhar * 760, vida: 0.9}); }
      else if (temEspada && kuim.golpe <= 0) {
        kuim.golpe = 0.3;
        if (chefe && chefe.ativo && !chefe.morto && Math.abs(chefe.x - kuim.x) < chefe.r + 70 && Math.sign(chefe.x - kuim.x) === kuim.olhar && Math.abs(chefe.y - kuim.y) < chefe.r + 50)
          bater(10 + Math.floor(moedasPegas / 20), kuim.x + kuim.olhar * 60, kuim.y); // moeda deixa mais forte
      }
    }
    ataquePedido = false;
    for (const t of tiros) {
      t.x += t.vx * dt; t.vida -= dt;
      if (chefe && chefe.ativo && !chefe.morto && Math.hypot(t.x - chefe.x, t.y - chefe.y) < chefe.r) { t.vida = 0; bater(15, t.x, t.y); }
    }
    for (let i = tiros.length - 1; i >= 0; i--) if (tiros[i].vida <= 0) tiros.splice(i, 1);

    // desafio da lava: 1 minuto sem encostar no chão
    if (desafio && desafio.estado === 'ativo') {
      desafio.t -= dt;
      if (desafio.t <= 0) {
        desafio.estado = 'feito'; somaMoedas(DESAFIO_PREMIO);
        aviso('DESAFIO CUMPRIDO!', '#ffd84d', `+${DESAFIO_PREMIO} moedas`);
        for (let i = 0; i < 4; i++) brilho(kuim.x + entre(-80, 80), kuim.y - entre(0, 120), '#ffd84d');
        depoisDoDesafio();
      }
    }

    atualizarChefe(dt);

    for (const p of particulas) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt * p.g; p.vida -= dt; }
    for (let i = particulas.length - 1; i >= 0; i--) if (particulas[i].vida <= 0) particulas.splice(i, 1);
    for (const n of numeros) { n.y -= 60 * dt; n.vida -= dt; }
    for (let i = numeros.length - 1; i >= 0; i--) if (numeros[i].vida <= 0) numeros.splice(i, 1);
    tremor = Math.max(0, tremor - dt * 30);

    // câmera segue o Kuim e o mundo nunca acaba (na arena do chefão ela trava)
    const alvoCam = chefe && chefe.ativo && !chefe.morto ? chefe.arenaIni : Math.max(0, kuim.x - W * 0.35);
    cam += (alvoCam - cam) * Math.min(1, dt * 6);
    while (fimGerado < cam + W * 2) gerarBloco();
    kuim.piscar -= dt; if (kuim.piscar < -3) kuim.piscar = 0.12;
  }
  function queimou() {
    desafio.estado = 'falhou';
    kuim.vy = -900; kuim.noChao = false;
    for (let i = 0; i < 3; i++) brilho(kuim.x, kuim.y + 20, '#ff5a1f');
    aviso('QUEIMOU!', '#ff5a1f', 'sem as 250 moedas');
    depoisDoDesafio();
  }

  // ---------------------------------------------------------------- chefão Bolotão (ideia de @OtseniOfical)
  function bater(dano, x, y) {
    chefe.vida = Math.max(0, chefe.vida - dano); chefe.flash = 0.12; tremor = 4;
    numeros.push({x, y: y - 30, txt: '-' + dano, vida: 0.7});
    brilho(x, y, '#ffffff');
    if (chefe.vida <= 0) {
      chefe.morto = true; somaMoedas(100); tremor = 12;
      for (let i = 0; i < 8; i++) brilho(chefe.x + entre(-60, 60), chefe.y + entre(-60, 60), i % 2 ? '#ff3d8b' : '#ffd84d');
      aviso('CHEFÃO DERROTADO!', '#ffd84d', '+100 moedas');
    }
  }
  function atualizarChefe(dt) {
    if (!chefe || chefe.morto) return;
    const c = chefe;
    if (!c.ativo && kuim.x > c.arenaIni + 150) { c.ativo = true; aviso('CHEFÃO: BOLOTÃO', '#ff3d8b', `${CHEFE_VIDA} de vida`); }
    c.flash -= dt;
    if (!c.ativo) return;
    c.t -= dt;
    if (c.noChao && c.t <= 0) {
      const raiva = 1 - c.vida / CHEFE_VIDA;
      c.vx = Math.sign(kuim.x - c.x) * (200 + raiva * 120); c.vy = -(820 + raiva * 200); c.noChao = false;
      c.t = 1.5 - raiva * 0.6;
    }
    c.vy += GRAV * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    c.x = Math.min(Math.max(c.x, c.arenaIni + c.r), c.arenaIni + W - c.r);
    if (c.y >= CHAO - c.r) {
      if (!c.noChao) { tremor = 6; poeira(c.x - 50, CHAO, 8); poeira(c.x + 50, CHAO, 8); c.esticar = -1; }
      c.y = CHAO - c.r; c.vy = 0; c.vx = 0; c.noChao = true;
    }
    c.esticar *= Math.pow(0.003, dt);
    // encostou no Kuim
    if (Math.hypot(c.x - kuim.x, c.y - kuim.y) < c.r + kuim.r - 6 && kuim.inv <= 0) {
      const lado = Math.sign(kuim.x - c.x) || -1;
      kuim.kb = lado * 520; kuim.vy = -520; kuim.noChao = false; kuim.inv = 0.8;
      if (temEspada && escudoT <= 0) { escudoT = 3; brilho(kuim.x + lado * -30, kuim.y, '#4dd2ff'); numeros.push({x: kuim.x, y: kuim.y - 50, txt: 'DEFENDEU!', vida: 0.8}); }
      else { somaMoedas(-5); numeros.push({x: kuim.x, y: kuim.y - 50, txt: '-5 🪙', vida: 0.8}); }
    }
  }
  function poeira(x, y, n) { for (let i = 0; i < n; i++) particulas.push({x, y, vx: entre(-120, 120), vy: entre(-160, -40), vida: 0.4, g: 1, cor: '#c9b8ff', t: 4}); }
  function brilho(x, y, cor) { for (let i = 0; i < 10; i++) { const a = rnd() * 6.28; particulas.push({x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, vida: 0.35, g: 0, cor, t: 5}); } }

  // ---------------------------------------------------------------- desenho
  function fundo() {
    const gr = g.createLinearGradient(0, 0, 0, H);
    const lava = desafio && desafio.estado === 'ativo';
    gr.addColorStop(0, lava ? '#3a0f2a' : '#2a1458'); gr.addColorStop(0.6, lava ? '#8a2a3a' : '#5b2a86'); gr.addColorStop(1, lava ? '#ff8a3d' : '#ff6fa8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 40; i++) { const x = ((i * 137 - cam * 0.05) % W + W) % W, y = (i * 71) % 420; g.fillRect(x, y, 2, 2); }
    for (const [vel, cor, alt] of [[0.15, '#3d1d6e', 330], [0.35, '#2b1450', 230]]) {
      g.fillStyle = cor; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 30) { const wx = x + cam * vel; g.lineTo(x, CHAO - alt * 0.4 - Math.sin(wx * 0.006) * 60 - Math.sin(wx * 0.017) * 25); }
      g.lineTo(W, H); g.fill();
    }
  }
  function desenharPilar(p, x) {
    const dentro = p.segredo && p.achado; // depois de achada, a passagem fica aberta
    if (dentro) {
      // a parede some e mostra a salinha secreta
      g.fillStyle = '#120a22'; g.fillRect(x, p.y, p.w, p.h || PILAR_H);
      g.save(); g.fillStyle = '#7cff9b'; g.font = '900 26px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('VITIN', x + p.w / 2, p.y + 34); g.restore();
      g.strokeStyle = '#7cff9b'; g.lineWidth = 3; g.strokeRect(x + 2, p.y + 2, p.w - 4, PILAR_H - 2);
      return;
    }
    g.fillStyle = '#3a2468'; g.fillRect(x, p.y, p.w, PILAR_H);
    g.fillStyle = '#4e3388'; for (let r = 0; r < PILAR_H; r += 28) for (let c = (r / 28) % 2 ? -25 : 0; c < p.w; c += 50) g.fillRect(x + Math.max(0, c) + 3, p.y + r + 3, Math.min(44, p.w - Math.max(0, c) - 6), 22);
    g.fillStyle = '#7cff9b'; g.fillRect(x, p.y, p.w, 8);
    if (p.segredo) { g.strokeStyle = 'rgba(20,10,40,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 62, p.y + 40); g.lineTo(x + 55, p.y + 58); g.lineTo(x + 66, p.y + 70); g.stroke(); } // a única pista: uma rachadura
  }
  function desenharItem(it) {
    const x = it.x - cam, y = it.y + Math.sin(tempo * 3) * 5;
    if (x < -40 || x > W + 40) return;
    g.save(); g.translate(x, y);
    if (it.tipo === 'arma') {
      const sala = plataformas.find(p => p.segredo && Math.abs(p.x + p.w / 2 - it.x) < 5);
      if (!sala || !sala.achado) { g.restore(); return; } // escondida dentro da parede
      desenharArma(0, 0, 1.3);
    } else {
      g.fillStyle = '#5b3a1a'; g.fillRect(-40, 40, 80, 30);
      g.rotate(-0.5); desenharEspada(0, 0, 1.4); g.rotate(0.5);
      desenharEscudo(28, 10, 1.2);
    }
    g.restore();
  }
  function desenharArma(x, y, e) {
    g.save(); g.translate(x, y); g.scale(e, e);
    g.fillStyle = '#4dd2ff'; g.beginPath(); g.roundRect(-16, -8, 34, 14, 5); g.fill();
    g.fillStyle = '#ff3d8b'; g.fillRect(-12, 4, 9, 14);
    g.fillStyle = '#ffd84d'; g.fillRect(16, -5, 8, 8);
    g.restore();
  }
  function desenharEspada(x, y, e) {
    g.save(); g.translate(x, y); g.scale(e, e);
    g.fillStyle = '#e8f6ff'; g.beginPath(); g.moveTo(-4, -40); g.lineTo(0, -48); g.lineTo(4, -40); g.lineTo(4, 0); g.lineTo(-4, 0); g.fill();
    g.fillStyle = '#ffd84d'; g.fillRect(-12, 0, 24, 5); g.fillStyle = '#7a4a1e'; g.fillRect(-3, 5, 6, 12);
    g.restore();
  }
  function desenharEscudo(x, y, e) {
    g.save(); g.translate(x, y); g.scale(e, e);
    g.fillStyle = '#4dd2ff'; g.beginPath(); g.moveTo(-13, -15); g.lineTo(13, -15); g.lineTo(13, 2); g.quadraticCurveTo(0, 20, -13, 2); g.fill();
    g.fillStyle = '#ffd84d'; g.fillRect(-2, -11, 4, 18); g.fillRect(-8, -5, 16, 4);
    g.restore();
  }
  function desenharKuim() {
    const {x, y, r} = kuim, e = kuim.esticar;
    if (kuim.inv > 0 && Math.floor(tempo * 20) % 2) return;
    g.save(); g.translate(x - cam, y);
    // equipamento atrás/na frente
    if (temEspada) {
      const sw = kuim.golpe > 0 ? (0.3 - kuim.golpe) / 0.3 : 0;
      g.save(); g.translate(kuim.olhar * (r + 4), -6); g.rotate(kuim.olhar * (0.3 + sw * 1.9)); desenharEspada(0, 0, 1); g.restore();
      if (sw > 0) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 6; g.beginPath(); g.arc(kuim.olhar * 10, -6, 62, kuim.olhar > 0 ? -1.2 : Math.PI - 0.4, kuim.olhar > 0 ? 0.4 : Math.PI + 1.2); g.stroke(); }
    }
    g.save(); g.scale(1 - e * 0.18, 1 + e * 0.22);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, r + 4, r * 0.9, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.ellipse(0, 0, r * 1.25, r, 0, 0, 7); g.fill();
    g.fillStyle = '#ff8cbb'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.45, r * 0.5, r * 0.22, -0.3, 0, 7); g.fill();
    g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(-kuim.olhar * r * 0.85, r * 0.15, 5, 0, 7); g.fill();
    g.fillStyle = '#4dd2ff'; g.beginPath(); g.arc(-kuim.olhar * r * 0.65, r * 0.4, 5, 0, 7); g.fill();
    const ox = kuim.olhar * r * 0.28, fecha = kuim.piscar > 0;
    for (const dx of [-11, 11]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ox + dx, -4, 8, fecha ? 1.5 : 10, 0, 0, 7); g.fill();
      if (!fecha) { g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(ox + dx + kuim.olhar * 3, -2, 4.5, 0, 7); g.fill(); }
    }
    g.fillStyle = '#c21d63'; const passo = kuim.noChao ? Math.sin(tempo * 18) * Math.min(1, Math.abs(kuim.vx) / VEL) * 6 : 0;
    g.beginPath(); g.ellipse(-12, r - 2 + passo, 9, 6, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(12, r - 2 - passo, 9, 6, 0, 0, 7); g.fill();
    g.restore();
    if (balas > 0) desenharArma(kuim.olhar * 26, 8, kuim.olhar);
    if (temEspada) { g.globalAlpha = escudoT > 0 ? 0.3 : 1; desenharEscudo(-kuim.olhar * 30, 6, 0.9); g.globalAlpha = 1; }
    g.restore();
  }
  function desenharChefe() {
    if (!chefe || chefe.morto) return;
    const c = chefe, x = c.x - cam; if (x < -150 || x > W + 150) return;
    g.save(); g.translate(x, c.y); g.scale(1 - c.esticar * 0.15, 1 + c.esticar * 0.2);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, c.r + 2, c.r, 10, 0, 0, 7); g.fill();
    g.fillStyle = c.flash > 0 ? '#ffffff' : '#7a2bd6'; g.beginPath(); g.ellipse(0, 0, c.r * 1.15, c.r, 0, 0, 7); g.fill();
    g.fillStyle = '#a45cff'; g.beginPath(); g.ellipse(-c.r * 0.35, -c.r * 0.5, c.r * 0.45, c.r * 0.2, -0.3, 0, 7); g.fill();
    // chifres e cara de bravo
    g.fillStyle = '#ffd84d';
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 40, -c.r * 0.8); g.lineTo(sx * 62, -c.r * 1.35); g.lineTo(sx * 70, -c.r * 0.7); g.fill(); }
    const olha = Math.sign(kuim.x - c.x) * 8;
    for (const dx of [-24, 24]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(dx + olha, -10, 15, 17, 0, 0, 7); g.fill();
      g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(dx + olha * 1.5, -6, 7, 0, 7); g.fill();
    }
    g.strokeStyle = '#1a0d2e'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-42 + olha, -34); g.lineTo(-10 + olha, -22); g.moveTo(42 + olha, -34); g.lineTo(10 + olha, -22); g.stroke();
    g.fillStyle = '#1a0d2e'; g.beginPath(); g.ellipse(olha, 30, 26, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillRect(olha - 16, 22, 8, 8); g.fillRect(olha + 8, 22, 8, 8);
    g.restore();
  }
  function texto(t, x, y, tam, cor, al = 'center') {
    g.font = `900 ${tam}px system-ui, "Segoe UI", sans-serif`; g.textAlign = al;
    g.lineWidth = Math.max(4, tam / 6); g.strokeStyle = '#120a22'; g.strokeText(t, x, y);
    g.fillStyle = cor; g.fillText(t, x, y);
  }
  function hud() {
    let y = 128;
    if (balas > 0) { texto(`🔫 ${balas}`, 22, y, 30, '#4dd2ff', 'left'); y += 40; }
    if (temEspada) { texto(escudoT > 0 ? '🛡️ recarregando' : '🛡️ pronto', 22, y, 24, escudoT > 0 ? '#9a8fbf' : '#4dd2ff', 'left'); y += 36; }
    if (desafio && desafio.estado === 'ativo') {
      const t = Math.max(0, Math.ceil(desafio.t));
      texto('CHÃO É LAVA', W / 2, 250, 40, '#ff5a1f');
      texto(`0:${String(t).padStart(2, '0')}`, W / 2, 310, 58, '#ffd84d');
    }
    if (chefe && chefe.ativo && !chefe.morto) {
      const bw = 380, bx = (W - bw) / 2, by = 230;
      texto('BOLOTÃO', W / 2, by - 12, 30, '#ff3d8b');
      g.fillStyle = '#120a22'; g.fillRect(bx - 4, by - 4, bw + 8, 30);
      g.fillStyle = '#ff3d8b'; g.fillRect(bx, by, bw * chefe.vida / CHEFE_VIDA, 22);
      texto(`${chefe.vida} / ${CHEFE_VIDA}`, W / 2, by + 19, 18, '#fff');
    }
    for (const n of numeros) { g.globalAlpha = Math.min(1, n.vida * 2); texto(n.txt, n.x - cam, n.y, 30, '#fff'); }
    g.globalAlpha = 1;
    const a = avisos[0];
    if (a && a.t > 0) {
      g.globalAlpha = Math.min(1, a.t * 2);
      const esc = 1 + Math.max(0, a.t - 2.1) * 1.5;
      g.save(); g.translate(W / 2, 420); g.scale(esc, esc);
      texto(a.txt, 0, 0, a.txt.length > 14 ? 40 : 50, a.cor);
      if (a.sub) texto(a.sub, 0, 46, 26, '#fff');
      g.restore(); g.globalAlpha = 1;
    }
    if (desafio && desafio.estado === 'escolha') {
      g.fillStyle = 'rgba(10,4,24,.82)'; g.fillRect(0, 0, W, H);
      texto('DESAFIO!', W / 2, 300, 64, '#ff5a1f');
      texto('O chão vira lava por 1 minuto.', W / 2, 370, 26, '#fff');
      texto('Só pode pisar no amarelo.', W / 2, 408, 26, '#fff');
      texto(`Vale ${DESAFIO_PREMIO} moedas.`, W / 2, 452, 32, '#ffd84d');
      for (const [bx, txt, sub, cor] of [[40, 'PASSAR', '◀', '#5b4a8a'], [W / 2 + 10, 'ENCARAR', '⤒', '#ff3d8b']]) {
        g.fillStyle = cor; g.beginPath(); g.roundRect(bx, 520, W / 2 - 50, 110, 20); g.fill();
        texto(txt, bx + (W / 2 - 50) / 2, 572, 32, '#fff'); texto(sub, bx + (W / 2 - 50) / 2, 612, 26, '#fff');
      }
    }
  }
  function desenhar() {
    g.save();
    if (tremor > 0) g.translate(entre(-tremor, tremor), entre(-tremor, tremor));
    fundo();
    for (const p of plataformas) {
      const x = p.x - cam; if (x > W || x + p.w < 0) continue;
      if (p.pilar) { desenharPilar(p, x); continue; }
      if (p.chao) {
        if (p.lava) {
          g.fillStyle = '#c4260c'; g.fillRect(x, p.y, p.w, H - p.y);
          g.fillStyle = '#ff7a1f'; for (let k = 0; k < p.w; k += 24) g.fillRect(x + k, p.y + Math.sin(tempo * 4 + (p.x + k) * 0.05) * 5, 24, 16);
          g.fillStyle = '#ffd84d'; for (let k = 10; k < p.w; k += 70) g.fillRect(x + k, p.y + 24 + Math.sin(tempo * 3 + k) * 6, 8, 8);
        } else {
          g.fillStyle = '#1b0f33'; g.fillRect(x, p.y, p.w, H - p.y);
          g.fillStyle = '#7cff9b'; g.fillRect(x, p.y, p.w, 14);
          g.fillStyle = '#3fbf68'; for (let k = 6; k < p.w; k += 22) g.fillRect(x + k, p.y + 14, 10, 6);
        }
      } else {
        g.fillStyle = '#ffd84d'; g.beginPath(); g.roundRect(x, p.y, p.w, 22, 11); g.fill();
        g.fillStyle = '#e0a800'; g.fillRect(x + 10, p.y + 16, p.w - 20, 6);
      }
    }
    if (desafio && desafio.estado === 'espera') {
      const x = desafio.x - cam;
      if (x > -100 && x < W + 100) {
        g.fillStyle = '#7a4a1e'; g.fillRect(x - 5, CHAO - 120, 10, 120);
        g.fillStyle = '#ff5a1f'; g.beginPath(); g.roundRect(x - 70, CHAO - 190, 140, 80, 12); g.fill();
        texto('DESAFIO', x, CHAO - 158, 24, '#fff'); texto('🔥 250 🪙', x, CHAO - 126, 22, '#ffd84d');
      }
    }
    for (const m of moedas) {
      if (m.pega) continue; const x = m.x - cam; if (x < -20 || x > W + 20) continue;
      const larg = Math.abs(Math.cos(tempo * 4 + m.x * 0.01)) * 13 + 2, flut = Math.sin(tempo * 3 + m.x) * 4;
      g.fillStyle = '#ffd84d'; g.beginPath(); g.ellipse(x, m.y + flut, larg, 15, 0, 0, 7); g.fill();
      g.fillStyle = '#fff3b0'; g.beginPath(); g.ellipse(x - larg * 0.3, m.y + flut - 4, larg * 0.3, 5, 0, 0, 7); g.fill();
    }
    for (const it of itens) if (!it.pego) desenharItem(it);
    desenharChefe();
    for (const t of tiros) { g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(t.x - cam, t.y, 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(t.x - cam, t.y, 4, 0, 7); g.fill(); }
    for (const p of particulas) { g.globalAlpha = Math.max(0, p.vida * 2.5); g.fillStyle = p.cor; g.fillRect(p.x - cam, p.y, p.t, p.t); }
    g.globalAlpha = 1;
    desenharKuim();
    g.restore();
    hud();
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
  if (params.has('dbg')) window.__dbg = () => ({kx: kuim.x | 0, ky: kuim.y | 0, vx: kuim.vx | 0, noChao: kuim.noChao, est: desafio && desafio.estado, plats: plataformas.filter(p => p.x + p.w > kuim.x - 100 && p.x < kuim.x + 300).map(p => [p.x | 0, p.y, p.w | 0, p.lava ? 'L' : p.chao ? 'C' : 'P'].join(':')).join(' ')});
})();
