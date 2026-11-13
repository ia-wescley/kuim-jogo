// Kuim: o jogo que os comentários do kuimenso constroem.
// Mundo infinito para a direita, gerado em blocos. Cada episódio acrescenta algo aqui.
// Dia 1 (10/11/2026): passagem secreta com arma (@Vitin-d6w), chefão de 550 de vida + espada e escudo
// (@OtseniOfical, com o boss de @lovepets5492: moeda deixa a espada mais forte) e o desafio "chão é lava" (@Arthurwicthoff).
// Dia 2 (11/11/2026): barra de vida de 100 e animação de morte (@Num-sei-0 e @ashfarmadordeaura), espinhos no chão
// (pedido 2 dias seguidos) e a loja do Kuim com terno e bigode por 600 moedas e munição (@Vitin-d6w).
// Dia 3 (12/11/2026): conquistas (@curioziudo), chefão secreto Esqueleto com 750 de vida e 3 flechas de 20
// que acorda quando alguém acha a passagem secreta (@Vitin-d6w, com o esqueleto de @ashfarmadordeaura)
// e o modo hardcore: moeda vale 2, todo dano é 80 e a cada minuto o jogo acelera; 10 minutos vivo vence (@Pyetrool_Ofc).
// Dia 4 (13/11/2026): zumbis andando pelo mapa (@Zhilak_9918, com os "inimigos normais" de @Vitin-d6w), o chefão
// Mago Gigante, que joga magias e faz espinhos brotarem do chão (@Vitin-d6w, parte 2) e o chapeleiro, um cara que
// joga um chapéu estiloso pro Kuim (@aprenda_comigocubo).
(() => {
  'use strict';
  const W = 540, H = 960;
  const tela = document.getElementById('tela');
  const g = tela.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo');            // ?demo=1: o bot joga sozinho (usado para gravar o vídeo)
  const IR = params.get('ir') || '';
  const LIMPO = params.has('limpo');          // ?limpo=1: sem textos no meio da tela (clipes que ficam atrás das cartelas do vídeo)          // atalho para gravar: parede | lava | chefe
  const HARDCORE = params.has('hardcore');    // ?hardcore=1: modo hardcore (ideia de @Pyetrool_Ofc)
  const QUASE = params.has('quase');          // ?quase=1: chefão começa quase morto (só para gravar o final da luta)
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
  const VIDA_MAX = 100, DANO_ESPINHO = 20, DANO_CHEFE = 20;
  const PRECO_TERNO = 600, PRECO_BALAS = 60;
  const ESQ_VIDA = 750, DANO_FLECHA = 20, DANO_HARDCORE = 80, HARDCORE_META = 600;
  const MAGO_VIDA = 1000, DANO_MAGIA = 20, DANO_ZUMBI = 20, ZUMBI_VIDA = 30, ZUMBI_PREMIO = 3;

  // ---------------------------------------------------------------- mundo
  const plataformas = []; // {x, y, w, chao?, lava?, pilar?, segredo?}
  const moedas = [];      // {x, y, pega}
  const itens = [];       // {x, y, tipo: 'arma'|'espada', pego}
  const espinhos = [];    // {x, w} no chão
  const lojas = [];       // {x, usada}
  const zumbis = [];      // {x, dir, min, max, vida, morto, flash}
  let chapeleiro = null, chapeuVoando = null; // o cara que joga o chapéu (ideia de @aprenda_comigocubo)
  let fimGerado = 0, blocoN = 0, geraModo = 'normal';
  const BLOCO_SEGREDO = IR === 'parede' ? 3 : 4 + Math.floor(rnd() * 3);
  const BLOCO_CHAPEU = IR === 'chapeu' ? 1 : IR ? -1 : 2;
  const BLOCO_PLACA = IR === 'lava' ? 2 : IR ? -1 : 11;
  const BLOCO_LOJA = IR === 'loja' ? 1 : IR ? -1 : 7;
  const pendente = IR === 'chefe' ? ['pedestal', 'arena', 'vazio'] : IR === 'esqueleto' ? ['pedestal', 'esqueleto', 'vazio'] : IR === 'mago' ? ['pedestal', 'mago', 'vazio'] : [];
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
  // zumbis (ideia de @Zhilak_9918): andam num trecho de chão e correm atrás do Kuim
  function zumbiEm(idx, a, b) {
    if (idx < 2 || IR === 'espinho' || IR === 'morte' || b - a < 110 || !(IR === 'zumbi' || rnd() < 0.85)) return;
    zumbis.push({x: entre(Math.max(a + 40, b - 220), b), dir: -1, min: a, max: b, vida: ZUMBI_VIDA, morto: false, flash: 0});
  }
  function gerarBloco() {
    const x0 = fimGerado, idx = blocoN++;
    fimGerado += BLOCO;
    if (pendente.length) {
      const t = pendente[0];
      if ((t === 'arena' || t === 'esqueleto' || t === 'mago') && chefe && !chefe.morto) { chaoCheio(x0); moedaChao(x0 + 270); return; } // espera o chefão atual cair
      pendente.shift();
      chaoCheio(x0);
      if (t === 'pedestal') { itens.push({x: x0 + 270, y: CHAO - 70, tipo: 'espada', pego: false}); moedaChao(x0 + 120); moedaChao(x0 + 420); }
      if (t === 'arena') {
        const ini = x0 + 270;
        chefe = {tipo: 'bolotao', nome: 'BOLOTÃO', vidaMax: CHEFE_VIDA, arenaIni: ini, x: ini + 420, y: CHAO - 80, r: 80, vx: 0, vy: 0, vida: CHEFE_VIDA, ativo: false, morto: false, t: 1.2, flash: 0, noChao: true, esticar: 0};
      }
      if (t === 'esqueleto') {
        // chefão secreto (ideia de @Vitin-d6w e @ashfarmadordeaura): fica de longe e solta 3 flechas seguidas
        const ini = x0 + 270;
        chefe = {tipo: 'esqueleto', nome: 'ESQUELETO', vidaMax: ESQ_VIDA, arenaIni: ini, x: ini + 400, y: CHAO - 75, r: 55, vx: 0, vy: 0, vida: ESQ_VIDA, ativo: false, morto: false, t: 1.6, flash: 0, noChao: true, esticar: 0, olhar: -1, serie: 0, tiroT: 0, arco: 0};
      }
      if (t === 'mago') {
        // chefão Mago Gigante (ideia de @Vitin-d6w): joga magias e faz espinhos brotarem embaixo do Kuim
        const ini = x0 + 270;
        chefe = {tipo: 'mago', nome: 'MAGO GIGANTE', vidaMax: MAGO_VIDA, arenaIni: ini, base: ini + 405, x: ini + 405, y: CHAO - 110, r: 110, vx: 0, vy: 0, vida: MAGO_VIDA, ativo: false, morto: false, t: 1.4, flash: 0, noChao: true, esticar: 0, olhar: -1, vez: 0, cajado: 0};
      }
      if (chefe && QUASE && !chefe.ativo) chefe.vida = Math.round(chefe.vidaMax * 0.12);
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
    if (idx === BLOCO_LOJA || (!IR && idx > BLOCO_LOJA && (idx - BLOCO_LOJA) % 18 === 0)) {
      // a loja do Kuim (ideia de @Vitin-d6w)
      chaoCheio(x0);
      lojas.push({x: x0 + 300, usada: false});
      moedaChao(x0 + 100);
      return;
    }
    if (idx === BLOCO_CHAPEU) {
      // o chapeleiro (ideia de @aprenda_comigocubo): chegou perto, ele joga um chapéu estiloso
      chaoCheio(x0);
      chapeleiro = {x: x0 + 330, deu: false};
      moedaChao(x0 + 100); moedaChao(x0 + 470);
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
    if (x0 > 0 && IR !== 'zumbi' && rnd() < 0.45) {
      const buraco = entre(90, 150), ini = entre(120, BLOCO - buraco - 60);
      plataformas.push({x: x0, y: CHAO, w: ini, chao: true});
      plataformas.push({x: x0 + ini + buraco, y: CHAO, w: BLOCO - ini - buraco, chao: true});
      zumbiEm(idx, x0 + ini + buraco + 30, x0 + BLOCO - 30);
    } else {
      chaoCheio(x0);
      if (x0 > 0 && IR !== 'zumbi' && rnd() < 0.5) { const px = x0 + entre(150, BLOCO - 250); plataformas.push({x: px, y: CHAO - PILAR_H, w: PILAR_W, pilar: true}); zumbiEm(idx, px + PILAR_W + 30, x0 + BLOCO - 30); }
      else {
        if (x0 > 0 && IR !== 'zumbi' && (IR === 'espinho' || IR === 'morte' || rnd() < 0.6)) espinhos.push({x: x0 + entre(120, BLOCO - 200), w: 3 + Math.floor(rnd() * 3)}); // espinhos (pedido 2 dias seguidos)
        zumbiEm(idx, x0 + 30, x0 + BLOCO - 30);
      }
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
    for (let i = espinhos.length - 1; i >= 0; i--) if (espinhos[i].x + espinhos[i].w * 26 >= X) espinhos.splice(i, 1);
    for (let i = lojas.length - 1; i >= 0; i--) if (lojas[i].x >= X) lojas.splice(i, 1);
    for (let i = zumbis.length - 1; i >= 0; i--) if (zumbis[i].max >= X) zumbis.splice(i, 1);
    fimGerado = X;
  }
  for (let i = 0; i < 4; i++) gerarBloco();

  // ---------------------------------------------------------------- jogador
  const kuim = {x: 120, y: CHAO - 60, vx: 0, vy: 0, kb: 0, r: 30, noChao: false, olhar: 1, piscar: 0, esticar: 0, golpe: 0, inv: 0, vida: IR === 'morte' ? 20 : VIDA_MAX, morto: 0, giro: 0, terno: false, chapeu: false};
  let lojaAberta = null, botLoja = 0, mortes = 0;
  let moedasPegas = IR === 'loja' && DEMO ? PRECO_TERNO + 40 : (IR === 'esqueleto' || IR === 'mago') && DEMO ? 400 : 0, cam = 0, tempo = 0, balas = (IR === 'chefe' || IR === 'esqueleto' || IR === 'mago') && DEMO ? 20 : 0, temEspada = false, escudoT = 0, tremor = 0;
  const particulas = [], tiros = [], avisos = [], numeros = [], flechas = [], orbes = [], magEsp = [];
  let acordouT = 0, espetadas = 0, hcT = 0, hcVenceu = false, zumbisMortos = 0;
  const placar = document.getElementById('moedas');
  const somaMoedas = n => { moedasPegas = Math.max(0, moedasPegas + n); placar.textContent = moedasPegas; if (moedasPegas >= 100) conquista('moeda100'); };

  // ---------------------------------------------------------------- conquistas (ideia de @curioziudo)
  // Ficam só no aparelho de quem joga (localStorage); nada é enviado para lugar nenhum.
  const CONQ = [
    ['moeda1', 'Primeira moeda', 'pegou a 1ª moedinha'],
    ['moeda100', 'Rico', '100 moedas no bolso'],
    ['morte1', 'Morreu', 'a 1ª de muitas'],
    ['espinho5', 'Almofada de alfinete', 'pisou em espinho 5 vezes'],
    ['segredo', 'Fuçador', 'achou a passagem secreta'],
    ['lava', 'Pé de amianto', 'venceu o chão é lava'],
    ['terno', 'Chique', 'comprou terno com bigode'],
    ['bolotao', 'Estourou o Bolotão', 'derrotou o 1º chefão'],
    ['esqueleto', 'Caçador de ossos', 'derrotou o chefão secreto'],
    ['hardcore', 'Hardcore de verdade', '10 minutos vivo no hardcore'],
    ['chapeu', 'Estiloso', 'ganhou o chapéu do chapeleiro'],
    ['zumbi10', 'Mata-zumbi', 'acabou com 10 zumbis'],
    ['mago', 'Apagou o mago', 'derrotou o Mago Gigante'],
  ];
  let feitas = new Set();
  if (!DEMO) { try { feitas = new Set(JSON.parse(localStorage.getItem('kuim-conquistas') || '[]')); } catch (e) { /* sem storage */ } }
  const toasts = [];
  function conquista(id) {
    if (feitas.has(id)) return;
    feitas.add(id);
    const c = CONQ.find(x => x[0] === id); if (!c) return;
    toasts.push({nome: c[1], sub: c[2], t: 3.2});
    if (!DEMO) { try { localStorage.setItem('kuim-conquistas', JSON.stringify([...feitas])); } catch (e) { /* sem storage */ } }
  }
  placar.textContent = moedasPegas;
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
    const r = tela.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (lojaAberta) { if (y > 480 && y < 760) { if (x < W / 3) sairLoja(); else if (x < W * 2 / 3) comprar('balas'); else comprar('terno'); } return; }
    if (!desafio || desafio.estado !== 'escolha') return;
    if (x < W / 2) passarDesafio(); else encararDesafio();
  });

  // ---------------------------------------------------------------- vida, espinhos e morte (ideias de @Num-sei-0 e @ashfarmadordeaura)
  function dano(n, lado) {
    if (kuim.morto > 0 || kuim.inv > 0) return;
    if (HARDCORE) n = DANO_HARDCORE; // no hardcore todo dano é 80
    kuim.vida = Math.max(0, kuim.vida - n); kuim.inv = 0.9; tremor = 5;
    kuim.kb = (lado || -kuim.olhar) * 420; kuim.vy = -620; kuim.noChao = false;
    numeros.push({x: kuim.x, y: kuim.y - 50, txt: '-' + n + ' ❤', vida: 0.8});
    if (kuim.vida <= 0) morrer();
  }
  function morrer() {
    kuim.morto = 2.6; kuim.vy = -900; kuim.kb = 0; kuim.vx = 0; kuim.giro = 0; mortes++; tremor = 10;
    conquista('morte1'); if (HARDCORE && !hcVenceu) hcT = 0; // no hardcore, morreu = o relógio volta pro zero
    for (let i = 0; i < 3; i++) brilho(kuim.x, kuim.y, '#ff3d8b');
  }
  function renascer() {
    const seguro = plataformas.filter(p => p.chao && !p.lava && p.x + p.w < kuim.x - 60 && p.x + p.w > cam).pop() || plataformas.find(p => p.chao) || plataformas[0];
    kuim.x = Math.max(seguro.x + 40, cam + 80); kuim.y = CHAO - 300; kuim.vy = 0; kuim.giro = 0;
    kuim.vida = VIDA_MAX; kuim.inv = 1.5; kuim.morto = 0;
    for (const e of espinhos) if (Math.abs(e.x - kuim.x) < 120) e.x += 200; // não renasce em cima de espinho
    aviso('RENASCEU', '#7cff9b', 'vida cheia de novo');
  }

  // ---------------------------------------------------------------- loja do Kuim (ideia de @Vitin-d6w)
  function sairLoja() { lojaAberta.usada = true; lojaAberta = null; kuim.x += 10; }
  function comprar(oque) {
    if (oque === 'terno') {
      if (kuim.terno) return aviso('Já tá de terno', '#c9b8ff');
      if (moedasPegas < PRECO_TERNO) return aviso('Pobre demais', '#ff5a1f', `o terno custa ${PRECO_TERNO} moedas`);
      somaMoedas(-PRECO_TERNO); kuim.terno = true; conquista('terno'); aviso('KUIM DE TERNO!', '#ffd84d', 'com bigode e tudo');
      for (let i = 0; i < 5; i++) brilho(kuim.x + entre(-60, 60), kuim.y - entre(0, 80), '#ffd84d');
    } else {
      if (moedasPegas < PRECO_BALAS) return aviso('Pobre demais', '#ff5a1f', `as balas custam ${PRECO_BALAS} moedas`);
      somaMoedas(-PRECO_BALAS); balas += 20; aviso('+20 BALAS', '#4dd2ff');
    }
  }

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
    pendente.push('pedestal', 'arena', 'vazio');
  }

  // ---------------------------------------------------------------- bot do modo demo
  let botPulo = 0, botEscolha = 0, botParado = 0;
  function bot(dt) {
    if (botParado > 0) { botParado -= dt; tecla.dir = false; tecla.esq = false; return; }
    if (desafio && desafio.estado === 'escolha') { botEscolha += dt; if (botEscolha > 1.5) encararDesafio(); return; }
    if (lojaAberta) {
      botLoja += dt;
      if (botLoja > 1.6 && !kuim.terno && moedasPegas >= PRECO_TERNO) comprar('terno');
      else if (botLoja > 2.6 && moedasPegas >= PRECO_BALAS && balas === 0) comprar('balas');
      else if (botLoja > 3.4) { sairLoja(); botLoja = 0; }
      return;
    }
    if (kuim.morto > 0) return;
    tecla.esq = false; tecla.dir = true;
    if (botPulo > 0) { botPulo -= dt; tecla.pulo = true; } else tecla.pulo = false;
    if (chefe && chefe.ativo && !chefe.morto) {
      const d = chefe.x - kuim.x, dist = Math.abs(d);
      const mg = chefe.tipo === 'mago', longe = mg ? 150 : 115;
      tecla.dir = d > 0 && dist > longe; tecla.esq = d < 0 && dist > longe;
      if (mg && dist < 128) { tecla.dir = d < 0; tecla.esq = d > 0; } // não encosta no manto
      kuim.olhar = Math.sign(d) || 1;
      if (balas > 0 ? rnd() < 0.25 : (dist < (mg ? 178 : 130) && kuim.golpe <= 0)) ataquePedido = true;
      if (mg && kuim.noChao) {
        // pula quando os espinhos mágicos vão brotar embaixo dele
        const av = magEsp.find(m => !m.fase && m.t < 0.16 && Math.abs(m.x - kuim.x) < 85);
        if (av) { puloPedido = true; botPulo = 0.5; }
        return;
      }
      if (kuim.noChao && !chefe.noChao && dist < 220 && rnd() < 0.05) puloPedido = true;
      if (chefe.tipo === 'esqueleto' && kuim.noChao) {
        // desvia das flechas pulando
        const fl = flechas.find(f => Math.sign(f.vx) === Math.sign(kuim.x - f.x) && Math.abs(f.x - kuim.x) < 105);
        if (fl) { puloPedido = true; botPulo = 0.3; }
      }
      return;
    }
    if (!kuim.noChao) {
      // sem arma, o bot mira o pisão na cabeça do zumbi
      const za = balas === 0 && !temEspada && zumbis.find(z => !z.morto && z.x > kuim.x - 70 && z.x - kuim.x < 160);
      if (za && kuim.vy > -250) { tecla.dir = za.x > kuim.x + 10; tecla.esq = za.x < kuim.x - 10; }
      return;
    }
    const sob = plataformas.find(p => !p.chao && !p.pilar && kuim.x > p.x - 6 && kuim.x < p.x + p.w + 6 && Math.abs(kuim.y + kuim.r - p.y) < 3);
    if (desafio && desafio.estado === 'ativo') {
      // simula o pulo curto e só pula quando vai cair no meio da próxima plataforma
      const prox = plataformas.filter(p => !p.chao && !p.pilar && p !== sob && p.x > kuim.x + 10).sort((a, b) => a.x - b.x)[0];
      if (prox && pousoDoPulo(prox.y) >= prox.x + 50) puloPedido = true;
      return;
    }
    const chaoEm = fx => plataformas.some(p => p.chao && fx > p.x && fx < p.x + p.w);
    const temChao = chaoEm(kuim.x + 45) && chaoEm(kuim.x + 85);
    const zb = zumbis.find(z => !z.morto && z.x > kuim.x - 10 && z.x - kuim.x < 255);
    if (zb) {
      if (balas > 0) { if (rnd() < 0.2) ataquePedido = true; }
      else if (temEspada) { if (zb.x - kuim.x < 92 && kuim.golpe <= 0) ataquePedido = true; }
      else if (!sob) { puloPedido = true; botPulo = 0.16; return; } // pisão na cabeça
    }
    const pilar = plataformas.find(p => p.pilar && !p.segredo && p.x > kuim.x && p.x - kuim.x < 90);
    if (pilar && !sob) { puloPedido = true; botPulo = 0.45; return; }
    const esp = IR !== 'morte' && espinhos.find(e => e.x > kuim.x && e.x - kuim.x < 75);
    if (esp && !sob) { puloPedido = true; botPulo = 0.45; return; }
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
    const lojaPerto = lojas.find(l => !l.usada && kuim.x >= l.x && kuim.x < l.x + 60 && kuim.noChao);
    if (lojaPerto && !lojaAberta && kuim.morto <= 0) { lojaAberta = lojaPerto; kuim.vx = 0; puloPedido = false; ataquePedido = false; botLoja = 0; }
    if (lojaAberta) {
      if (tecla.esq) sairLoja(); else if (ataquePedido) comprar('balas'); else if (puloPedido) comprar('terno');
      puloPedido = false; ataquePedido = false;
      return; // jogo pausado na loja
    }
    if (kuim.morto > 0) {
      // animação de morte: olho de X, gira, pula pra cima e cai pra fora da tela
      kuim.morto -= dt; kuim.giro += dt * 9; kuim.vy += GRAV * 0.6 * dt; kuim.y += kuim.vy * dt;
      for (const p of particulas) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt * p.g; p.vida -= dt; }
      for (let i = particulas.length - 1; i >= 0; i--) if (particulas[i].vida <= 0) particulas.splice(i, 1);
      for (const n of numeros) { n.y -= 60 * dt; n.vida -= dt; }
      for (let i = numeros.length - 1; i >= 0; i--) if (numeros[i].vida <= 0) numeros.splice(i, 1);
      tremor = Math.max(0, tremor - dt * 30);
      if (kuim.morto <= 0) renascer();
      puloPedido = false; ataquePedido = false; return;
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
      if (p.segredo && !p.achado && kuim.x > p.x + 10 && kuim.x < p.x + p.w - 10 && kuim.y > p.y) {
        p.achado = true; botParado = 1.6; conquista('segredo');
        if (!temEspada) pendente.push('pedestal');
        pendente.push('esqueleto', 'vazio'); acordouT = 3.2; // achou a passagem: o chefão secreto acorda
      }
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

    for (const e of espinhos) {
      if (kuim.x + kuim.r * 0.6 > e.x && kuim.x - kuim.r * 0.6 < e.x + e.w * 26 && kuim.y + kuim.r > CHAO - 22) {
        if (kuim.inv <= 0 && kuim.morto <= 0 && ++espetadas >= 5) conquista('espinho5');
        dano(DANO_ESPINHO, -1); break;
      }
    }
    // zumbis (ideia de @Zhilak_9918): encostou perde 20 de vida; pisão na cabeça, tiro ou espadada resolvem
    for (const z of zumbis) {
      if (z.morto || Math.abs(z.x - kuim.x) > 800) continue;
      const viu = Math.abs(kuim.x - z.x) < 270;
      if (viu) z.dir = Math.sign(kuim.x - z.x) || z.dir;
      z.x += z.dir * (viu ? 95 : 45) * dt; z.flash -= dt;
      if (z.x < z.min) { z.x = z.min; z.dir = 1; } else if (z.x > z.max) { z.x = z.max; z.dir = -1; }
      if (Math.abs(z.x - kuim.x) < kuim.r + 20 && kuim.y + kuim.r > CHAO - 84) {
        if (kuim.vy > 150 && kuim.y < CHAO - 72) { matarZumbi(z); kuim.vy = -720; kuim.noChao = false; kuim.esticar = 1; }
        else if (kuim.inv <= 0) dano(DANO_ZUMBI, Math.sign(kuim.x - z.x) || -1);
      }
    }
    // o chapeleiro joga o chapéu quando o Kuim chega perto (ideia de @aprenda_comigocubo)
    if (chapeleiro && !chapeleiro.deu && kuim.x > chapeleiro.x - 200) { chapeleiro.deu = true; chapeuVoando = {x: chapeleiro.x, y: CHAO - 190, t: 0}; }
    if (chapeuVoando) {
      const c = chapeuVoando; c.t += dt; const k = Math.min(1, c.t / 0.9);
      c.x += (kuim.x - c.x) * Math.min(1, dt * (3 + k * 16));
      c.y = (CHAO - 190) * (1 - k) + (kuim.y - kuim.r - 4) * k - Math.sin(k * Math.PI) * 170;
      if (k >= 1) {
        chapeuVoando = null; kuim.chapeu = true; conquista('chapeu');
        aviso('CHAPÉU ESTILOSO!', '#ffd84d', 'presente do chapeleiro');
        for (let i = 0; i < 3; i++) brilho(kuim.x + entre(-40, 40), kuim.y - 40, '#ffd84d');
      }
    }
    for (const m of moedas) {
      if (!m.pega && Math.hypot(m.x - kuim.x, m.y - kuim.y) < kuim.r + 16) { m.pega = true; somaMoedas(HARDCORE ? 2 : 1); conquista('moeda1'); brilho(m.x, m.y, '#ffd84d'); }
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
        for (const z of zumbis) if (!z.morto && (z.x - kuim.x) * kuim.olhar > -10 && Math.abs(z.x - kuim.x) < 100 && kuim.y + kuim.r > CHAO - 100) matarZumbi(z);
      }
    }
    ataquePedido = false;
    for (const t of tiros) {
      t.x += t.vx * dt; t.vida -= dt;
      if (chefe && chefe.ativo && !chefe.morto && Math.hypot(t.x - chefe.x, t.y - chefe.y) < chefe.r) { t.vida = 0; bater(15, t.x, t.y); }
      for (const z of zumbis) if (t.vida > 0 && !z.morto && Math.abs(t.x - z.x) < 24 && t.y > CHAO - 86) {
        t.vida = 0; z.vida -= 15; z.flash = 0.12; brilho(t.x, t.y, '#ffffff'); if (z.vida <= 0) matarZumbi(z);
      }
    }
    for (let i = tiros.length - 1; i >= 0; i--) if (tiros[i].vida <= 0) tiros.splice(i, 1);
    // flechas do esqueleto: 20 de vida cada, só pulando para desviar
    for (const f of flechas) {
      f.x += f.vx * dt; f.vida -= dt;
      if (kuim.morto <= 0 && Math.abs(f.x - kuim.x) < kuim.r + 14 && Math.abs(f.y - kuim.y) < kuim.r + 2) { f.vida = 0; dano(DANO_FLECHA, Math.sign(f.vx)); }
    }
    for (let i = flechas.length - 1; i >= 0; i--) if (flechas[i].vida <= 0) flechas.splice(i, 1);
    // magias do Mago Gigante: bola roxa mirada no Kuim e espinhos que brotam do chão depois do aviso
    for (const o of orbes) {
      o.x += o.vx * dt; o.y += o.vy * dt; o.vida -= dt;
      if (o.y > CHAO - 10) { o.vida = 0; brilho(o.x, CHAO - 10, '#b56bff'); }
      else if (kuim.morto <= 0 && Math.hypot(o.x - kuim.x, o.y - kuim.y) < kuim.r + 14) { o.vida = 0; brilho(o.x, o.y, '#b56bff'); dano(DANO_MAGIA, Math.sign(o.vx) || -1); }
    }
    for (let i = orbes.length - 1; i >= 0; i--) if (orbes[i].vida <= 0) orbes.splice(i, 1);
    for (const m of magEsp) {
      m.t -= dt;
      if (!m.fase && m.t <= 0) { m.fase = 1; m.t = 0.5; tremor = Math.max(tremor, 3); }
      if (m.fase && kuim.morto <= 0 && Math.abs(kuim.x - m.x) < 50 + kuim.r * 0.6 && kuim.y + kuim.r > CHAO - 36) dano(DANO_ESPINHO, Math.sign(kuim.x - m.x) || -1);
    }
    for (let i = magEsp.length - 1; i >= 0; i--) if (magEsp[i].fase && magEsp[i].t <= 0) magEsp.splice(i, 1);
    if (acordouT > 0) { acordouT -= dt; if (acordouT <= 0) aviso('ALGO ACORDOU...', '#e9e4d4', 'um chefão secreto vem aí'); }
    // modo hardcore: 10 minutos vivo vence
    if (HARDCORE && !hcVenceu) {
      hcT += dt / ritmo();
      if (hcT >= HARDCORE_META) { hcVenceu = true; somaMoedas(1000); conquista('hardcore'); aviso('VENCEU O HARDCORE!', '#ff3d3d', '+1000 moedas'); }
    }

    // desafio da lava: 1 minuto sem encostar no chão
    if (desafio && desafio.estado === 'ativo') {
      desafio.t -= dt;
      if (desafio.t <= 0) {
        desafio.estado = 'feito'; somaMoedas(DESAFIO_PREMIO); conquista('lava');
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
      const esq = chefe.tipo === 'esqueleto', mg = chefe.tipo === 'mago', premio = mg ? 300 : esq ? 150 : 100;
      chefe.morto = true; somaMoedas(premio); tremor = 12; flechas.length = 0; orbes.length = 0; magEsp.length = 0;
      if (chefe.tipo === 'bolotao') pendente.push('vazio', 'vazio', 'mago', 'vazio'); // depois do Bolotão vem o Mago Gigante
      for (let i = 0; i < 8; i++) brilho(chefe.x + entre(-60, 60), chefe.y + entre(-60, 60), esq ? (i % 2 ? '#e9e4d4' : '#ffd84d') : (i % 2 ? '#ff3d8b' : '#ffd84d'));
      conquista(chefe.tipo);
      aviso(mg ? 'MAGO APAGADO!' : esq ? 'ESQUELETO DESMONTADO!' : 'CHEFÃO DERROTADO!', '#ffd84d', `+${premio} moedas`);
    }
  }
  function atualizarChefe(dt) {
    if (!chefe || chefe.morto) return;
    const c = chefe;
    if (!c.ativo && kuim.x > c.arenaIni + 150) {
      c.ativo = true;
      if (c.tipo === 'mago') aviso('MAGO GIGANTE!', '#b56bff', `${MAGO_VIDA} de vida`);
      else if (c.tipo === 'esqueleto') aviso('CHEFÃO SECRETO!', '#e9e4d4', `esqueleto com ${ESQ_VIDA} de vida`);
      else aviso('CHEFÃO: BOLOTÃO', '#ff3d8b', `${CHEFE_VIDA} de vida`);
    }
    c.flash -= dt;
    if (!c.ativo) return;
    if (c.tipo === 'esqueleto') return atualizarEsqueleto(c, dt);
    if (c.tipo === 'mago') return atualizarMago(c, dt);
    c.t -= dt;
    if (c.noChao && c.t <= 0) {
      const raiva = 1 - c.vida / c.vidaMax;
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
      else { kuim.inv = 0; dano(DANO_CHEFE, lado); }
    }
  }
  function atualizarEsqueleto(c, dt) {
    const d = kuim.x - c.x, dist = Math.abs(d);
    c.olhar = Math.sign(d) || -1;
    const raiva = 1 - c.vida / c.vidaMax;
    // arqueiro: gosta de ficar longe
    const anda = dist < 200 ? -c.olhar : dist > 330 ? c.olhar : 0;
    c.x += anda * 80 * dt; c.andando = anda !== 0;
    c.x = Math.min(Math.max(c.x, c.arenaIni + c.r), c.arenaIni + W - c.r);
    c.t -= dt; c.arco -= dt;
    if (c.t <= 0 && c.serie <= 0) { c.serie = 3; c.tiroT = 0.35; c.t = 2.6 - raiva * 0.9; }
    if (c.serie > 0) {
      c.tiroT -= dt;
      if (c.tiroT <= 0) {
        flechas.push({x: c.x + c.olhar * 50, y: CHAO - 32, vx: c.olhar * (420 + raiva * 120), vida: 2.4});
        c.serie--; c.tiroT = 0.3; c.arco = 0.18;
      }
    }
    // encostou no Kuim
    if (Math.hypot(c.x - kuim.x, c.y - kuim.y) < c.r + kuim.r - 4 && kuim.inv <= 0) {
      const lado = Math.sign(kuim.x - c.x) || -1;
      kuim.kb = lado * 520; kuim.vy = -520; kuim.noChao = false; kuim.inv = 0.8;
      if (temEspada && escudoT <= 0) { escudoT = 3; brilho(kuim.x + lado * -30, kuim.y, '#4dd2ff'); numeros.push({x: kuim.x, y: kuim.y - 50, txt: 'DEFENDEU!', vida: 0.8}); }
      else { kuim.inv = 0; dano(DANO_CHEFE, lado); }
    }
  }
  function atualizarMago(c, dt) {
    c.olhar = Math.sign(kuim.x - c.x) || -1;
    const raiva = 1 - c.vida / c.vidaMax;
    c.x = c.base + Math.sin(tempo * 0.7) * 28;
    c.t -= dt; c.cajado -= dt;
    if (c.t <= 0) {
      c.cajado = 0.45; c.vez++;
      if (c.vez % 2) {
        // magia: bola roxa que sai do cajado mirando onde o Kuim está
        const ox = c.x + c.olhar * 95, oy = CHAO - 258, a = Math.atan2(kuim.y - oy, kuim.x - ox), v = 360 + raiva * 140;
        orbes.push({x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 3});
      } else {
        // espinhos: avisa no chão embaixo do Kuim e depois brota
        magEsp.push({x: kuim.x, t: 0.9, fase: 0});
        if (raiva > 0.5) magEsp.push({x: kuim.x + (rnd() < 0.5 ? -130 : 130), t: 1.15, fase: 0});
      }
      c.t = 1.6 - raiva * 0.8;
    }
    // encostou no manto
    if (Math.hypot(c.x - kuim.x, c.y - kuim.y) < c.r + kuim.r - 6 && kuim.inv <= 0) {
      const lado = Math.sign(kuim.x - c.x) || -1;
      kuim.kb = lado * 520; kuim.vy = -520; kuim.noChao = false; kuim.inv = 0.8;
      if (temEspada && escudoT <= 0) { escudoT = 3; brilho(kuim.x + lado * -30, kuim.y, '#4dd2ff'); numeros.push({x: kuim.x, y: kuim.y - 50, txt: 'DEFENDEU!', vida: 0.8}); }
      else { kuim.inv = 0; dano(DANO_CHEFE, lado); }
    }
  }
  function matarZumbi(z) {
    z.morto = true; somaMoedas(HARDCORE ? ZUMBI_PREMIO * 2 : ZUMBI_PREMIO); tremor = Math.max(tremor, 4);
    numeros.push({x: z.x, y: CHAO - 100, txt: '+' + (HARDCORE ? ZUMBI_PREMIO * 2 : ZUMBI_PREMIO) + ' 🪙', vida: 0.8});
    brilho(z.x, CHAO - 50, '#6fbf4a'); brilho(z.x, CHAO - 30, '#ffd84d');
    if (++zumbisMortos >= 10) conquista('zumbi10');
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
    if (kuim.inv > 0 && kuim.morto <= 0 && Math.floor(tempo * 20) % 2) return;
    g.save(); g.translate(x - cam, y);
    if (kuim.morto > 0) g.rotate(kuim.giro);
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
    if (kuim.terno) {
      // terno preto com camisa branca e gravata vermelha (skin da loja)
      g.save(); g.beginPath(); g.ellipse(0, 0, r * 1.25, r, 0, 0, 7); g.clip();
      g.fillStyle = '#16121f'; g.fillRect(-r * 1.3, r * 0.3, r * 2.6, r);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-9, r * 0.3); g.lineTo(9, r * 0.3); g.lineTo(0, r * 0.95); g.fill();
      g.fillStyle = '#e0182d'; g.beginPath(); g.moveTo(-4, r * 0.32); g.lineTo(4, r * 0.32); g.lineTo(3, r * 0.8); g.lineTo(0, r * 0.95); g.lineTo(-3, r * 0.8); g.fill();
      g.restore();
    }
    const ox = kuim.olhar * r * 0.28, fecha = kuim.piscar > 0;
    for (const dx of [-11, 11]) {
      if (kuim.morto > 0) { // olho de X
        g.strokeStyle = '#1a0d2e'; g.lineWidth = 4; g.beginPath();
        g.moveTo(ox + dx - 6, -10); g.lineTo(ox + dx + 6, 2); g.moveTo(ox + dx + 6, -10); g.lineTo(ox + dx - 6, 2); g.stroke();
        continue;
      }
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ox + dx, -4, 8, fecha ? 1.5 : 10, 0, 0, 7); g.fill();
      if (!fecha) { g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(ox + dx + kuim.olhar * 3, -2, 4.5, 0, 7); g.fill(); }
    }
    if (kuim.chapeu) desenharChapeu(ox * 0.5, -r + 5, 1); // presente do chapeleiro
    if (kuim.terno) { // bigode
      g.fillStyle = '#2a160a'; g.beginPath();
      g.ellipse(ox - 9, 11, 11, 5, 0.35, 0, 7); g.ellipse(ox + 9, 11, 11, 5, -0.35, 0, 7); g.fill();
    }
    g.fillStyle = '#c21d63'; const passo = kuim.noChao ? Math.sin(tempo * 18) * Math.min(1, Math.abs(kuim.vx) / VEL) * 6 : 0;
    g.beginPath(); g.ellipse(-12, r - 2 + passo, 9, 6, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(12, r - 2 - passo, 9, 6, 0, 0, 7); g.fill();
    g.restore();
    if (balas > 0) desenharArma(kuim.olhar * 26, 8, kuim.olhar);
    if (temEspada) { g.globalAlpha = escudoT > 0 ? 0.3 : 1; desenharEscudo(-kuim.olhar * 30, 6, 0.9); g.globalAlpha = 1; }
    g.restore();
  }
  function desenharEsqueleto(c, x) {
    const osso = c.flash > 0 ? '#ffffff' : '#ece6d2', escuro = '#1a0d2e';
    g.save(); g.translate(x, c.y);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 76, 46, 8, 0, 0, 7); g.fill();
    g.strokeStyle = osso; g.lineCap = 'round';
    const passo = c.andando ? Math.sin(tempo * 9) * 7 : 0;
    g.lineWidth = 9; g.beginPath(); g.moveTo(-12, 30); g.lineTo(-16 + passo, 72); g.moveTo(12, 30); g.lineTo(16 - passo, 72); g.stroke();
    g.lineWidth = 8; g.beginPath(); g.moveTo(0, -26); g.lineTo(0, 32); g.stroke();
    g.lineWidth = 5; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(0, -14 + k * 11, 25 - k * 3, 5, 0, 0, 7); g.stroke(); }
    g.fillStyle = osso; g.beginPath(); g.ellipse(0, 30, 20, 8, 0, 0, 7); g.fill();
    // braço segurando o arco virado para o Kuim
    const o = c.olhar || -1;
    g.lineWidth = 7; g.beginPath(); g.moveTo(0, -20); g.lineTo(o * 36, -12); g.moveTo(0, -20); g.lineTo(o * (c.arco > 0 ? 6 : 18), -8); g.stroke();
    g.save(); g.translate(o * 40, -12); g.scale(o, 1);
    g.strokeStyle = '#9a5f2a'; g.lineWidth = 6; g.beginPath(); g.arc(-18, 0, 44, -1.1, 1.1); g.stroke();
    const puxa = c.arco > 0 ? -22 : (c.serie > 0 ? -14 : 0);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18 + 44 * Math.cos(1.1), -44 * Math.sin(1.1)); g.lineTo(puxa, 0); g.lineTo(-18 + 44 * Math.cos(1.1), 44 * Math.sin(1.1)); g.stroke();
    g.restore();
    // crânio
    g.fillStyle = osso; g.beginPath(); g.arc(0, -60, 32, 0, 7); g.fill(); g.beginPath(); g.roundRect(-18, -42, 36, 18, 5); g.fill();
    g.fillStyle = escuro; g.beginPath(); g.arc(-12, -62, 9, 0, 7); g.arc(12, -62, 9, 0, 7); g.fill();
    g.fillStyle = '#ff3d3d'; g.beginPath(); g.arc(-12 + o * 2, -61, 3.5, 0, 7); g.arc(12 + o * 2, -61, 3.5, 0, 7); g.fill();
    g.fillStyle = escuro; g.beginPath(); g.moveTo(0, -50); g.lineTo(-5, -42); g.lineTo(5, -42); g.fill();
    for (let k = -2; k <= 2; k++) g.fillRect(k * 6 - 1, -35, 2, 9);
    g.restore();
  }
  function desenharChapeu(x, y, e) {
    // chapéu estiloso: preto com faixa dourada e pena azul
    g.save(); g.translate(x, y); g.scale(e, e);
    g.strokeStyle = '#ffd84d'; g.lineWidth = 2; g.fillStyle = '#120a22';
    g.beginPath(); g.roundRect(-19, -32, 38, 32, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0, 0, 36, 8, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#ffd84d'; g.fillRect(-19, -13, 38, 7);
    g.fillStyle = '#4dd2ff'; g.beginPath(); g.ellipse(18, -28, 5, 16, 0.5, 0, 7); g.fill();
    g.restore();
  }
  function desenharChapeleiro() {
    if (!chapeleiro) return;
    const x = chapeleiro.x - cam; if (x < -120 || x > W + 120) return;
    const pulo = chapeleiro.deu ? Math.abs(Math.sin(tempo * 6)) * 6 : 0;
    g.save(); g.translate(x, CHAO - pulo);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, pulo + 2, 34, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#12b3a6'; g.beginPath(); g.roundRect(-30, -78, 60, 78, 22); g.fill();
    g.fillStyle = '#0c8c82'; g.fillRect(-30, -22, 60, 8);
    for (const dx of [-11, 11]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(dx - 4, -52, 8, 10, 0, 0, 7); g.fill(); g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(dx - 7, -50, 4.5, 0, 7); g.fill(); }
    g.strokeStyle = '#1a0d2e'; g.lineWidth = 4; g.beginPath(); g.arc(-4, -36, 10, 0.2, 2.6); g.stroke();
    // pilha de chapéus na cabeça (fica com 1 a menos depois de dar o presente)
    for (let k = 0; k < (chapeleiro.deu ? 2 : 3); k++) desenharChapeu(0, -80 - k * 30, 1);
    g.restore();
    texto(chapeleiro.deu ? 'tá estiloso!' : 'CHAPÉUS', x, CHAO - 196 - (chapeleiro.deu ? 0 : 0), 22, '#ffd84d');
  }
  function desenharZumbi(z) {
    const x = z.x - cam; if (z.morto || x < -60 || x > W + 60) return;
    const p = Math.sin(tempo * 7 + z.min) * 5, pele = z.flash > 0 ? '#ffffff' : '#6fbf4a';
    g.save(); g.translate(x, CHAO); g.scale(z.dir, 1);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 2, 24, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#3b2a6b'; g.fillRect(-13, -24 + Math.max(0, p) * 0.6, 10, 24 - Math.max(0, p) * 0.6); g.fillRect(3, -24 + Math.max(0, -p) * 0.6, 10, 24 - Math.max(0, -p) * 0.6);
    g.fillStyle = '#4a6fd6'; g.beginPath(); g.roundRect(-17, -54, 34, 34, 6); g.fill();
    g.fillStyle = '#1b0f33'; g.beginPath(); g.moveTo(-17, -20); g.lineTo(-9, -29); g.lineTo(-2, -20); g.lineTo(6, -28); g.lineTo(17, -20); g.fill();
    g.fillStyle = pele; g.fillRect(6, -48 + p * 0.4, 32, 8); g.fillRect(6, -36 - p * 0.4, 28, 8);
    g.beginPath(); g.roundRect(-18, -86, 38, 34, 9); g.fill();
    g.fillStyle = '#3f8a2a'; g.fillRect(-18, -86, 12, 8);
    g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(0, -71, 4, 0, 7); g.arc(12, -72, 6, 0, 7); g.fill();
    g.fillRect(0, -61, 15, 3);
    g.restore();
  }
  function desenharMago(c, x) {
    const cl = c.flash > 0, o = c.olhar || -1;
    g.save(); g.translate(x, CHAO);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 4, 112, 12, 0, 0, 7); g.fill();
    g.translate(0, Math.sin(tempo * 2) * 6 - 8);
    // manto azul com estrelas
    g.fillStyle = cl ? '#fff' : '#2b2fb8'; g.beginPath(); g.moveTo(-105, 0); g.lineTo(-48, -215); g.lineTo(48, -215); g.lineTo(105, 0); g.fill();
    g.fillStyle = cl ? '#fff' : '#1c1f85'; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-8, -200); g.lineTo(8, -200); g.lineTo(20, 0); g.fill();
    g.fillStyle = '#ffd84d'; for (const [sx, sy] of [[-58, -55], [50, -92], [-38, -140], [64, -32]]) { g.save(); g.translate(sx, sy); g.rotate(tempo + sx); g.fillRect(-4, -4, 8, 8); g.restore(); }
    // cabeça, barba e cara de bravo
    g.fillStyle = cl ? '#fff' : '#f0c9a0'; g.beginPath(); g.arc(0, -236, 44, 0, 7); g.fill();
    g.fillStyle = '#f4f0ff'; g.beginPath(); g.moveTo(-42, -230); g.lineTo(42, -230); g.lineTo(o * 6, -118); g.fill();
    g.fillStyle = '#1a0d2e'; g.beginPath(); g.arc(-15 + o * 6, -246, 6, 0, 7); g.arc(15 + o * 6, -246, 6, 0, 7); g.fill();
    g.strokeStyle = '#f4f0ff'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-30 + o * 6, -264); g.lineTo(-7 + o * 6, -255); g.moveTo(30 + o * 6, -264); g.lineTo(7 + o * 6, -255); g.stroke();
    // chapéu pontudo
    g.fillStyle = cl ? '#fff' : '#2b2fb8'; g.beginPath(); g.moveTo(-60, -264); g.lineTo(60, -264); g.lineTo(-o * 16, -388); g.fill();
    g.beginPath(); g.ellipse(0, -264, 80, 13, 0, 0, 7); g.fill();
    g.fillStyle = '#ffd84d'; g.fillRect(-48, -288, 96, 10);
    // cajado com a bola de magia
    const er = c.cajado > 0 ? -22 : 0;
    g.strokeStyle = '#7a4a1e'; g.lineWidth = 9; g.beginPath(); g.moveTo(o * 88, -8); g.lineTo(o * 95, -232 + er); g.stroke();
    g.fillStyle = cl ? '#fff' : '#f0c9a0'; g.beginPath(); g.arc(o * 91, -112 + er * 0.5, 13, 0, 7); g.fill();
    g.fillStyle = 'rgba(181,107,255,.35)'; g.beginPath(); g.arc(o * 95, -250 + er, 30 + Math.sin(tempo * 8) * 4, 0, 7); g.fill();
    g.fillStyle = '#b56bff'; g.beginPath(); g.arc(o * 95, -250 + er, 18, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(o * 95 - 5, -255 + er, 6, 0, 7); g.fill();
    g.restore();
  }
  function desenharMagias() {
    for (const m of magEsp) {
      const x = m.x - cam;
      if (!m.fase) { // aviso: o chão brilha roxo antes de espetar
        g.globalAlpha = 0.45 + Math.sin(tempo * 30) * 0.25;
        g.fillStyle = '#b56bff'; g.beginPath(); g.ellipse(x, CHAO + 2, 58, 11, 0, 0, 7); g.fill(); g.globalAlpha = 1;
        texto('!', x, CHAO - 16, 34, '#b56bff');
      } else {
        const alt = 46 * Math.min(1, (0.5 - m.t) * 9, m.t * 9);
        for (let k = -2; k < 2; k++) {
          g.fillStyle = '#b56bff'; g.beginPath(); g.moveTo(x + k * 26, CHAO); g.lineTo(x + k * 26 + 13, CHAO - alt); g.lineTo(x + k * 26 + 26, CHAO); g.fill();
          g.fillStyle = '#6a2bd6'; g.beginPath(); g.moveTo(x + k * 26 + 13, CHAO - alt); g.lineTo(x + k * 26 + 26, CHAO); g.lineTo(x + k * 26 + 15, CHAO); g.fill();
        }
      }
    }
    for (const o of orbes) {
      const x = o.x - cam;
      g.fillStyle = 'rgba(181,107,255,.35)'; g.beginPath(); g.arc(x, o.y, 24, 0, 7); g.fill();
      g.fillStyle = '#b56bff'; g.beginPath(); g.arc(x, o.y, 14, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4, o.y - 4, 5, 0, 7); g.fill();
    }
  }
  function desenharFlecha(f) {
    const x = f.x - cam, s = Math.sign(f.vx);
    g.save(); g.translate(x, f.y); g.scale(s, 1);
    g.strokeStyle = '#9a5f2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-34, 0); g.lineTo(14, 0); g.stroke();
    g.fillStyle = '#d9d4ec'; g.beginPath(); g.moveTo(24, 0); g.lineTo(12, -7); g.lineTo(12, 7); g.fill();
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(-34, 0); g.lineTo(-42, -7); g.lineTo(-28, 0); g.lineTo(-42, 7); g.fill();
    g.restore();
  }
  function desenharChefe() {
    if (!chefe || chefe.morto) return;
    const c = chefe, x = c.x - cam; if (x < -170 || x > W + 170) return;
    if (c.tipo === 'esqueleto') return desenharEsqueleto(c, x);
    if (c.tipo === 'mago') return desenharMago(c, x);
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
    // barra de vida
    const vw = 170, vx = 22, vy = 112;
    g.fillStyle = '#120a22'; g.beginPath(); g.roundRect(vx - 4, vy - 4, vw + 8, 28, 8); g.fill();
    g.fillStyle = kuim.vida > 40 ? '#7cff9b' : '#ff3d3d'; g.beginPath(); g.roundRect(vx, vy, Math.max(0, vw * kuim.vida / VIDA_MAX), 20, 6); g.fill();
    texto(`❤ ${kuim.vida}`, vx + vw / 2, vy + 17, 18, '#fff');
    let y = 172;
    if (HARDCORE) {
      const t = Math.floor(hcT), r = ritmo();
      texto(hcVenceu ? '💀 HARDCORE VENCIDO' : `💀 ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} / 10:00  x${r.toFixed(1)}`, 22, y, 24, '#ff3d3d', 'left'); y += 38;
    }
    if (balas > 0) { texto(`🔫 ${balas}`, 22, y, 30, '#4dd2ff', 'left'); y += 40; }
    if (temEspada) { texto(escudoT > 0 ? '🛡️ recarregando' : '🛡️ pronto', 22, y, 24, escudoT > 0 ? '#9a8fbf' : '#4dd2ff', 'left'); y += 36; }
    if (LIMPO) { toasts.length = 0; for (const n of numeros) { g.globalAlpha = Math.min(1, n.vida * 2); texto(n.txt, n.x - cam, n.y, 30, '#fff'); } g.globalAlpha = 1; return; }
    if (desafio && desafio.estado === 'ativo') {
      const t = Math.max(0, Math.ceil(desafio.t));
      texto('CHÃO É LAVA', W / 2, 250, 40, '#ff5a1f');
      texto(`0:${String(t).padStart(2, '0')}`, W / 2, 310, 58, '#ffd84d');
    }
    if (chefe && chefe.ativo && !chefe.morto) {
      const bw = 380, bx = (W - bw) / 2, by = 230, cor = chefe.tipo === 'mago' ? '#b56bff' : chefe.tipo === 'esqueleto' ? '#e9e4d4' : '#ff3d8b';
      texto(chefe.nome, W / 2, by - 12, 30, cor);
      g.fillStyle = '#120a22'; g.fillRect(bx - 4, by - 4, bw + 8, 30);
      g.fillStyle = cor; g.fillRect(bx, by, bw * chefe.vida / chefe.vidaMax, 22);
      texto(`${chefe.vida} / ${chefe.vidaMax}`, W / 2, by + 19, 18, '#fff');
    }
    const ct = toasts[0];
    if (ct) {
      // aviso de conquista (desce do topo)
      const ty = (chefe && chefe.ativo && !chefe.morto) || (desafio && desafio.estado === 'ativo') ? 262 : 240;
      const ent = Math.min(1, (3.2 - ct.t) * 5), sai = Math.min(1, ct.t * 3);
      g.globalAlpha = Math.max(0, Math.min(ent, sai));
      g.save(); g.translate(0, (1 - ent) * -30);
      g.fillStyle = 'rgba(18,10,34,.92)'; g.beginPath(); g.roundRect(60, ty, W - 120, 78, 16); g.fill();
      g.strokeStyle = '#ffd84d'; g.lineWidth = 4; g.stroke();
      texto('🏆', 100, ty + 52, 36, '#ffd84d');
      texto('CONQUISTA!', 140, ty + 26, 18, '#ffd84d', 'left');
      texto(ct.nome, 140, ty + 52, ct.nome.length > 16 ? 22 : 26, '#fff', 'left');
      texto(ct.sub, 140, ty + 71, 15, '#c9b8ff', 'left');
      g.restore(); g.globalAlpha = 1;
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
    if (kuim.morto > 0) {
      g.fillStyle = `rgba(60,0,20,${Math.min(0.55, (2.6 - kuim.morto) * 0.5)})`; g.fillRect(0, 0, W, H);
      texto('MORREU!', W / 2, 360, 72, '#ff3d3d');
      texto(mortes > 1 ? `já são ${mortes} mortes` : 'a vida acabou', W / 2, 410, 28, '#fff');
    }
    if (lojaAberta) {
      g.fillStyle = 'rgba(10,4,24,.84)'; g.fillRect(0, 0, W, H);
      texto('LOJA DO KUIM', W / 2, 300, 54, '#ffd84d');
      texto(`você tem ${moedasPegas} moedas`, W / 2, 352, 26, '#fff');
      const opcoes = [['SAIR', '◀', '', '#5b4a8a'], ['+20 BALAS', '⚔', `${PRECO_BALAS} 🪙`, '#2a6fd6'], [kuim.terno ? 'JÁ É SEU' : 'TERNO E BIGODE', '⤒', `${PRECO_TERNO} 🪙`, '#ff3d8b']];
      opcoes.forEach(([txt, tecla, preco, cor], i) => {
        const bx = 16 + i * (W - 32) / 3, bw = (W - 32) / 3 - 10;
        g.fillStyle = cor; g.beginPath(); g.roundRect(bx, 500, bw, 230, 18); g.fill();
        const linhas = txt.split(' ');
        if (txt === 'TERNO E BIGODE') { texto('TERNO', bx + bw / 2, 560, 22, '#fff'); texto('E BIGODE', bx + bw / 2, 588, 22, '#fff'); }
        else texto(txt, bx + bw / 2, 574, linhas.length > 1 ? 22 : 26, '#fff');
        if (preco) texto(preco, bx + bw / 2, 640, 26, '#ffd84d');
        texto(tecla, bx + bw / 2, 700, 26, '#fff');
      });
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
    for (const e of espinhos) {
      const x = e.x - cam; if (x > W || x + e.w * 26 < 0) continue;
      for (let k = 0; k < e.w; k++) {
        g.fillStyle = '#d9d4ec'; g.beginPath(); g.moveTo(x + k * 26, CHAO); g.lineTo(x + k * 26 + 13, CHAO - 30); g.lineTo(x + k * 26 + 26, CHAO); g.fill();
        g.fillStyle = '#8f86b3'; g.beginPath(); g.moveTo(x + k * 26 + 13, CHAO - 30); g.lineTo(x + k * 26 + 26, CHAO); g.lineTo(x + k * 26 + 15, CHAO); g.fill();
      }
    }
    for (const l of lojas) {
      const x = l.x - cam; if (x < -160 || x > W + 160) continue;
      g.fillStyle = '#7a4a1e'; g.fillRect(x - 70, CHAO - 120, 12, 120); g.fillRect(x + 58, CHAO - 120, 12, 120);
      g.fillStyle = '#5b3a1a'; g.fillRect(x - 80, CHAO - 50, 160, 50);
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fff' : '#ff3d8b'; g.fillRect(x - 84 + k * 28, CHAO - 150, 28, 34); }
      texto('LOJA', x, CHAO - 160, 30, '#ffd84d');
      texto('🎩', x, CHAO - 66, 30, '#fff');
    }
    for (const m of moedas) {
      if (m.pega) continue; const x = m.x - cam; if (x < -20 || x > W + 20) continue;
      const larg = Math.abs(Math.cos(tempo * 4 + m.x * 0.01)) * 13 + 2, flut = Math.sin(tempo * 3 + m.x) * 4;
      g.fillStyle = '#ffd84d'; g.beginPath(); g.ellipse(x, m.y + flut, larg, 15, 0, 0, 7); g.fill();
      g.fillStyle = '#fff3b0'; g.beginPath(); g.ellipse(x - larg * 0.3, m.y + flut - 4, larg * 0.3, 5, 0, 0, 7); g.fill();
    }
    for (const it of itens) if (!it.pego) desenharItem(it);
    desenharChapeleiro();
    for (const z of zumbis) desenharZumbi(z);
    desenharChefe();
    desenharMagias();
    if (chapeuVoando) { g.save(); g.translate(chapeuVoando.x - cam, chapeuVoando.y); g.rotate(chapeuVoando.t * 9); desenharChapeu(0, 14, 1.15); g.restore(); }
    for (const f of flechas) desenharFlecha(f);
    for (const t of tiros) { g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(t.x - cam, t.y, 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(t.x - cam, t.y, 4, 0, 7); g.fill(); }
    for (const p of particulas) { g.globalAlpha = Math.max(0, p.vida * 2.5); g.fillStyle = p.cor; g.fillRect(p.x - cam, p.y, p.t, p.t); }
    g.globalAlpha = 1;
    desenharKuim();
    g.restore();
    hud();
  }

  // ---------------------------------------------------------------- laço
  let antes = performance.now();
  // hardcore: a cada minuto vivo o jogo fica 10% mais rápido (até 1,6x)
  function ritmo() { return HARDCORE && !hcVenceu ? Math.min(1.6, 1 + 0.1 * Math.floor(hcT / 60)) : 1; }
  function quadro(agora) {
    const dt = Math.min(0.033, (agora - antes) / 1000); antes = agora;
    if (toasts.length) { toasts[0].t -= dt; if (toasts[0].t <= 0) toasts.shift(); }
    atualizar(dt * ritmo()); desenhar(); requestAnimationFrame(quadro);
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
  document.getElementById('btnEp').onclick = () => {
    painel.hidden = false;
    const lc = document.getElementById('conqs'); lc.textContent = '';
    for (const [id, nome, sub] of CONQ) item(lc, (feitas.has(id) ? '🏆 ' : '🔒 ') + nome, sub);
  };
  const bh = document.getElementById('btnHard');
  if (bh) {
    if (HARDCORE) bh.classList.add('on');
    bh.onclick = () => { const q = new URLSearchParams(location.search); if (HARDCORE) q.delete('hardcore'); else q.set('hardcore', '1'); location.search = q.toString(); };
  }
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
      st.textContent = 'Atualizado: ' + new Date(d.atualizado).toLocaleString('pt-BR') + (d.velho ? ' (o LivePix está em pausa; pode estar um pouco atrasado)' : '');
      document.getElementById('cSaldo').textContent = reais(d.saldo);
      document.getElementById('cTotal').textContent = reais(d.totalRecebidoListado);
      const la = document.getElementById('cApoios'); la.textContent = '';
      if (!d.apoios.length) item(la, 'Ninguém apoiou ainda. Seja o primeiro!');
      for (const a of d.apoios.slice(0, 20)) item(la, `${a.nome}: ${reais(a.valor)}`, a.msg);
    } catch (e) { st.textContent = 'Não deu para ler o cofre agora.'; }
  }
  if (DEMO) document.getElementById('controles').style.display = 'none';
  if (params.has('dbg')) window.__dbg = () => ({vida: kuim.vida, chapeu: kuim.chapeu, zm: zumbisMortos, zv: zumbis.filter(z => !z.morto).length, chefe: chefe && [chefe.tipo, chefe.vida, chefe.ativo, chefe.morto].join(':'), moedas: moedasPegas, mortes, kx: kuim.x | 0, ky: kuim.y | 0, vx: kuim.vx | 0, noChao: kuim.noChao, est: desafio && desafio.estado, plats: plataformas.filter(p => p.x + p.w > kuim.x - 100 && p.x < kuim.x + 300).map(p => [p.x | 0, p.y, p.w | 0, p.lava ? 'L' : p.chao ? 'C' : 'P'].join(':')).join(' ')});
})();
