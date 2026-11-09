// Cofre transparente do Kuim: lê a carteira e os apoios do LivePix (só leitura) e devolve um resumo público.
// Variáveis de ambiente no Vercel: LIVEPIX_CLIENT_ID, LIVEPIX_CLIENT_SECRET (cadastradas pelo dono, tipo Secret).
// Segurança:
// - o token é pedido SÓ com escopos de leitura; nada aqui saca, transfere ou altera a conta;
// - o token e o segredo nunca saem da função (a resposta só tem números, nomes e mensagens filtradas);
// - só aceita GET/HEAD, ignora qualquer parâmetro da URL e guarda tudo em cache (60 s), então
//   ninguém consegue usar este endereço para martelar a API do LivePix;
// - se o LivePix limitar (429) ou cair, devolve o último resumo bom por até 1 h.
const ESCOPOS = 'wallet:read payments:read messages:read';
const CACHE_MS = 60_000, PAUSA_429_MS = 120_000, VELHO_MS = 3_600_000;
let tk = {valor: null, ate: 0, escopos: ''};
let cache = {em: 0, dados: null};
let pausaAte = 0, emAndamento = null;

async function token() {
  if (tk.valor && Date.now() < tk.ate) return tk.valor;
  const corpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.LIVEPIX_CLIENT_ID,
    client_secret: process.env.LIVEPIX_CLIENT_SECRET,
    scope: ESCOPOS,
  });
  const r = await fetch('https://oauth.livepix.gg/oauth2/token', {method: 'POST', body: corpo, headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
  if (!r.ok) throw Object.assign(new Error('token ' + r.status), {status: r.status});
  const j = await r.json();
  tk = {valor: j.access_token, ate: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000, escopos: j.scope || ''};
  return tk.valor;
}

async function api(caminho) {
  const r = await fetch('https://api.livepix.gg' + caminho, {headers: {Authorization: 'Bearer ' + (await token())}});
  if (r.status === 401) tk.ate = 0; // token vencido: pede outro na próxima
  if (!r.ok) throw Object.assign(new Error(caminho.split('?')[0] + ' ' + r.status), {status: r.status});
  return (await r.json()).data;
}

// nomes e mensagens vêm de quem apoiou: corta tamanho, tira links, @, marcação e caracteres de controle
const limpa = (t, n) => String(t || '')
  .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
  .replace(/https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|gg|io|me|br|xyz|link|ly)\b\S*/gi, '[link]')
  .replace(/[<>"'`]/g, '')
  .replace(/\s+/g, ' ')
  .slice(0, n).trim();

async function buscar() {
  const carteira = await api('/v2/wallet');
  const mensagens = await api('/v2/messages?limit=50').catch(() => []); // em sequência: menos chance de 429
  const lista = Array.isArray(carteira) ? carteira : [carteira];
  const brl = lista.find(c => String(c?.currency || '').toUpperCase() === 'BRL') || {};
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const apoios = (Array.isArray(mensagens) ? mensagens : []).map(m => ({
    nome: limpa(m.username || m.name, 30) || 'anônimo',
    valor: num(m.amount) / 100,
    quando: limpa(m.createdAt || m.created_at, 40) || null,
    msg: limpa(m.message, 120),
  }));
  return {
    ativo: true,
    atualizado: new Date().toISOString(),
    saldo: num(brl.balance) / 100,
    aReceber: num(brl.pendingBalance ?? brl.receivable) / 100,
    totalRecebidoListado: Math.round(apoios.reduce((s, a) => s + a.valor, 0) * 100) / 100,
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
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  if (!process.env.LIVEPIX_CLIENT_ID || !process.env.LIVEPIX_CLIENT_SECRET) {
    return res.status(200).json({ativo: false, aviso: 'Cofre ainda não conectado ao LivePix.'});
  }
  const agora = Date.now();
  if (cache.dados && agora - cache.em < CACHE_MS) return res.status(200).json(cache.dados);
  if (agora < pausaAte) {
    if (cache.dados && agora - cache.em < VELHO_MS) return res.status(200).json({...cache.dados, velho: true});
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    return res.status(200).json({ativo: false, aviso: 'LivePix pediu uma pausa, tenta daqui a pouco.'});
  }
  try {
    emAndamento = emAndamento || buscar().finally(() => { emAndamento = null; });
    cache = {em: Date.now(), dados: await emAndamento};
    return res.status(200).json(cache.dados);
  } catch (e) {
    if (e.status === 429) pausaAte = Date.now() + PAUSA_429_MS;
    if (cache.dados && agora - cache.em < VELHO_MS) return res.status(200).json({...cache.dados, velho: true});
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    return res.status(200).json({ativo: false, aviso: 'LivePix fora do ar agora, tenta daqui a pouco.', erro: String(e.message).slice(0, 40)});
  }
};
