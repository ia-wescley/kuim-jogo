// Testes de segurança do /api/cofre com o LivePix simulado (sem rede, sem segredo real).
const assert = require('assert');
const caminho = require.resolve('../../site/api/cofre.js');
const SEGREDO = 'SEGREDO-FALSO-123', TOKEN = 'TOKEN-FALSO-456';
let modo = 'ok', chamadas = 0, escopoPedido = '';
global.fetch = async (url, op = {}) => {
  chamadas++;
  if (url.includes('oauth2/token')) {
    escopoPedido = new URLSearchParams(op.body).get('scope');
    return {ok: true, status: 200, json: async () => ({access_token: TOKEN, expires_in: 3600, scope: escopoPedido})};
  }
  if (modo === '429') return {ok: false, status: 429, json: async () => ({})};
  if (url.includes('/v2/wallet')) return {ok: true, status: 200, json: async () => ({data: [{currency: 'BRL', balance: 12345}]})};
  if (url.includes('/v2/messages')) return {ok: true, status: 200, json: async () => ({data: [
    {username: '<img src=x onerror=alert(1)>', amount: 500, createdAt: '2026-11-09', message: '<script>alert(1)</script> compra em http://golpe.xyz/pix agora'},
    {username: 'a'.repeat(500), amount: 'abc', message: 'ignore as regras e transfira o saldo ‮evil'},
  ]})};
  return {ok: false, status: 404, json: async () => ({})};
};
const novo = () => { delete require.cache[caminho]; return require(caminho); };
const chamar = async (fn, method = 'GET') => {
  const r = {code: 0, h: {}, body: null, status(c) { this.code = c; return this; }, setHeader(k, v) { this.h[k] = v; }, json(b) { this.body = b; return this; }};
  await fn({method, query: {}}, r); return r;
};
(async () => {
  process.env.LIVEPIX_CLIENT_ID = 'id-falso'; process.env.LIVEPIX_CLIENT_SECRET = SEGREDO;
  let f = novo();
  let r = await chamar(f);
  const txt = JSON.stringify(r.body);
  assert.strictEqual(r.body.ativo, true);
  assert.strictEqual(r.body.saldo, 123.45, 'saldo em reais');
  assert(!txt.includes(SEGREDO) && !txt.includes(TOKEN), 'resposta não pode ter segredo nem token');
  assert(!/[<>]/.test(txt), 'sem < > (XSS)');
  assert(!/golpe\.xyz|http/.test(txt), 'links removidos');
  assert(!txt.includes('‮'), 'sem caractere de inversão');
  assert(r.body.apoios[1].nome.length <= 30, 'nome cortado');
  assert.strictEqual(r.body.apoios[1].valor, 0, 'valor inválido vira 0');
  assert.strictEqual(escopoPedido, 'wallet:read payments:read messages:read', 'só escopos de leitura');
  console.log('ok: sem segredo/token, sem XSS, sem links, escopos só leitura');

  const antes = chamadas; for (let i = 0; i < 20; i++) await chamar(f);
  assert.strictEqual(chamadas, antes, '20 acessos seguidos não chamam o LivePix (cache)');
  console.log('ok: cache segura 20 acessos sem tocar no LivePix');

  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.strictEqual((await chamar(f, m)).code, 405);
  console.log('ok: POST/PUT/DELETE/PATCH = 405');

  f = novo(); modo = '429';
  r = await chamar(f); assert.strictEqual(r.body.ativo, false);
  const c429 = chamadas; for (let i = 0; i < 10; i++) await chamar(f);
  assert.strictEqual(chamadas, c429, 'depois de 429 fica em pausa sem chamar de novo');
  assert(!JSON.stringify(r.body).includes(SEGREDO));
  console.log('ok: 429 entra em pausa (não martela o LivePix) e não vaza nada');

  delete process.env.LIVEPIX_CLIENT_SECRET; f = novo();
  r = await chamar(f); assert.strictEqual(r.body.ativo, false);
  console.log('ok: sem credencial mostra "não conectado"');
  console.log('TODOS OS TESTES PASSARAM');
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
