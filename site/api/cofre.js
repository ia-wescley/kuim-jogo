// Cofre transparente do Kuim: lê a carteira e os apoios do LivePix (só leitura) e devolve um resumo público.
// Variáveis de ambiente no Vercel: LIVEPIX_CLIENT_ID, LIVEPIX_CLIENT_SECRET (cadastradas pelo dono, tipo Secret).
// Segurança:
// - o token é pedido SÓ com escopos de leitura; nada aqui saca, transfere ou altera a conta;
// - o token e o segredo nunca saem da função (a resposta só tem números, nomes e mensagens filtradas);
// - só aceita GET/HEAD; URL com parâmetro (?x=...) é redirecionada para /api/cofre sem tocar no LivePix,
//   para ninguém furar o cache da CDN e gastar o limite de chamadas (10/11: um ?t= aleatório causava 429);
// - cache de 5 min na função e na CDN (com stale-while-revalidate), então o LivePix é chamado poucas vezes por hora;
// - se o LivePix limitar (429), respeita o Retry-After e espera cada vez mais (5, 10, 20, até 60 min);
// - se o LivePix limitar ou cair, devolve o último resumo bom por até 24 h, marcado como "velho".
const ESCOPOS = 'wallet:read payments:read messages:read';
const CACHE_MS = 300_000, PAUSA_MIN_MS = 300_000, PAUSA_MAX_MS = 3_600_000, VELHO_MS = 86_400_000;
let tk = {valor: null, ate: 0, escopos: ''};
let cache = {em: 0, dados: null};
let pausaAte = 0, pausaAtual = 0, emAndamento = null;

async function token() {
  if (tk.valor && Date.now() < tk.ate) return tk.valor;
  const corpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.LIVEPIX_CLIENT_ID,
    client_secret: process.env.LIVEPIX_CLIENT_SECRET,
    scope: ESCOPOS,
  });
  const r = await fetch('https://oauth.livepix.gg/oauth2/token', {method: 'POST', body: corpo, headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
  if (!r.ok) throw Object.assign(new Error('token ' + r.status), {status: r.status, esperaS: 0});
  const j = await r.json();
  tk = {valor: j.access_token, ate: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000, escopos: j.scope || ''};
  return tk.valor;
}

async function api(caminho) {
  const r = await fetch('https://api.livepix.gg' + caminho, {headers: {Authorization: 'Bearer ' + (await token())}});
  if (r.status === 401) tk.ate = 0; // token vencido: pede outro na próxima
  const espera = Number(r.headers && r.headers.get && r.headers.get('retry-after'));
  if (!r.ok) throw Object.assign(new Error(caminho.split('?')[0] + ' ' + r.status), {status: r.status, esperaS: Number.isFinite(espera) ? espera : 0});
  return (await r.json()).data;
}

// nomes e mensagens vêm de quem apoiou: corta tamanho, tira links, @, marcação e caracteres de controle
const limpa = (t, n) => String(t || '')
  .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
  .replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|gg|io|me|br|xyz|link|ly)\b\S*/gi, '[link]')
  .replace(/[<>"'`]/g, '')
  .replace(/\s+/g, ' ')
  .slice(0, n).trim();

// Saldo: /v2/wallet tem limite GLOBAL de 100/min dividido entre todos os clientes do LivePix e vive em 429
// (11/11: 429 até numa chamada anônima). Plano B: o campo "balance" da transação mais recente em
// /v2/wallet/{moeda}/transactions (mesmo escopo wallet:read, limite de 1000/min). Plano C: último saldo bom.
async function saldoReais() {
  try {
    const carteira = await api('/v2/wallet');
    const lista = Array.isArray(carteira) ? carteira : [carteira];
    const brl = lista.find(c => String(c?.currency || '').toUpperCase() === 'BRL') || {};
    return {saldo: num(brl.balance) / 100, aReceber: num(brl.balancePending ?? brl.pendingBalance ?? brl.receivable) / 100, fonte: 'carteira'};
  } catch (e) {
    if (e.status !== 429) throw e;
    const tr = await api('/v2/wallet/BRL/transactions?limit=20');
    const lista = (Array.isArray(tr) ? tr : []).filter(t => Number.isFinite(Number(t?.balance)));
    if (!lista.length) return {saldo: 0, aReceber: null, fonte: 'extrato vazio'};
    const quando = t => Date.parse(t.timestamp || t.createdAt || '') || 0;
    const ultima = lista.reduce((a, b) => (quando(b) > quando(a) ? b : a));
    return {saldo: num(ultima.balance) / 100, aReceber: null, fonte: 'extrato'};
  }
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function buscar() {
  const s = await saldoReais();
  const mensagens = await api('/v2/messages?limit=50').catch(() => []); // em sequência: menos chance de 429
  const apoios = (Array.isArray(mensagens) ? mensagens : []).map(m => ({
    nome: limpa(m.username || m.name, 30) || 'anônimo',
    valor: num(m.amount) / 100,
    quando: limpa(m.createdAt || m.created_at, 40) || null,
    msg: limpa(m.message, 120),
  }));
  return {
    ativo: true,
    atualizado: new Date().toISOString(),
    saldo: s.saldo,
    aReceber: s.aReceber,
    fonteDoSaldo: s.fonte,
    totalRecebidoListado: Math.round(apoios.reduce((x, a) => x + a.valor, 0) * 100) / 100,
    apoiosListados: apoios.length,
    apoios,
    escoposDoToken: tk.escopos, // transparência: mostra que o acesso é só de leitura
  };
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({erro: 'só leitura'});
  }
  const temQuery = String(req.url || '').includes('?') || Object.keys(req.query || {}).length > 0;
  if (temQuery) {
    res.setHeader('Location', '/api/cofre');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(308).json({vaPara: '/api/cofre'});
  }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  if (!process.env.LIVEPIX_CLIENT_ID || !process.env.LIVEPIX_CLIENT_SECRET) {
    return res.status(200).json({ativo: false, aviso: 'Cofre ainda não conectado ao LivePix.'});
  }
  const agora = Date.now();
  if (cache.dados && agora - cache.em < CACHE_MS) return res.status(200).json(cache.dados);
  if (agora < pausaAte) {
    if (cache.dados && agora - cache.em < VELHO_MS) return res.status(200).json({...cache.dados, velho: true});
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ativo: false, aviso: 'O LivePix pediu uma pausa. O Pix continua funcionando; o saldo volta a aparecer daqui a pouco.'});
  }
  try {
    emAndamento = emAndamento || buscar().finally(() => { emAndamento = null; });
    cache = {em: Date.now(), dados: await emAndamento};
    pausaAtual = 0;
    return res.status(200).json(cache.dados);
  } catch (e) {
    if (e.status === 429) {
      pausaAtual = Math.min(PAUSA_MAX_MS, pausaAtual ? pausaAtual * 2 : PAUSA_MIN_MS);
      pausaAte = Date.now() + Math.max(pausaAtual, Math.min(PAUSA_MAX_MS, (e.esperaS || 0) * 1000));
    }
    if (cache.dados && agora - cache.em < VELHO_MS) return res.status(200).json({...cache.dados, velho: true});
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ativo: false, aviso: 'O LivePix não respondeu agora. O Pix continua funcionando; o saldo volta a aparecer daqui a pouco.', erro: String(e.message).slice(0, 40)});
  }
};
