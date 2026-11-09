// Cofre transparente do Kuim: lê a carteira e os apoios do LivePix (só leitura) e devolve um resumo público.
// Variáveis de ambiente no Vercel: LIVEPIX_CLIENT_ID, LIVEPIX_CLIENT_SECRET (app criado no LivePix só com escopos de leitura).
// Nada aqui consegue sacar, transferir ou mexer na conta: o token é pedido só com escopos *:read.
const ESCOPOS = 'wallet:read payments:read messages:read';
let cache = {em: 0, dados: null};

async function token() {
  const corpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.LIVEPIX_CLIENT_ID,
    client_secret: process.env.LIVEPIX_CLIENT_SECRET,
    scope: ESCOPOS,
  });
  const r = await fetch('https://oauth.livepix.gg/oauth2/token', {method: 'POST', body: corpo, headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
  if (!r.ok) throw new Error('token ' + r.status);
  return (await r.json()).access_token;
}

async function api(caminho, tk) {
  const r = await fetch('https://api.livepix.gg' + caminho, {headers: {Authorization: 'Bearer ' + tk}});
  if (!r.ok) throw new Error(caminho + ' ' + r.status);
  return (await r.json()).data;
}

// nomes e mensagens vêm de quem apoiou: corta tamanho e tira links/@ para ninguém usar o cofre como propaganda
const limpa = (t, n) => String(t || '').replace(/https?:\/\/\S+|www\.\S+/gi, '[link]').replace(/[<>]/g, '').slice(0, n).trim();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  if (!process.env.LIVEPIX_CLIENT_ID) {
    return res.status(200).json({ativo: false, aviso: 'Cofre ainda não conectado ao LivePix.'});
  }
  try {
    if (Date.now() - cache.em < 60000 && cache.dados) return res.status(200).json(cache.dados);
    const tk = await token();
    const [carteira, mensagens] = await Promise.all([api('/v2/wallet', tk), api('/v2/messages?limit=50', tk).catch(() => [])]);
    const brl = (Array.isArray(carteira) ? carteira : [carteira]).find(c => (c.currency || '').toUpperCase() === 'BRL') || {};
    const apoios = (mensagens || []).map(m => ({
      nome: limpa(m.username || m.name || 'anônimo', 30),
      valor: (m.amount || 0) / 100,
      quando: m.createdAt || m.created_at || null,
      msg: limpa(m.message, 120),
    }));
    const dados = {
      ativo: true,
      atualizado: new Date().toISOString(),
      saldo: (brl.balance ?? 0) / 100,
      aReceber: (brl.pendingBalance ?? brl.receivable ?? 0) / 100,
      totalRecebidoListado: apoios.reduce((s, a) => s + a.valor, 0),
      apoios,
    };
    cache = {em: Date.now(), dados};
    res.status(200).json(dados);
  } catch (e) {
    res.status(200).json({ativo: false, aviso: 'LivePix fora do ar agora, tenta daqui a pouco.', erro: String(e.message).slice(0, 80)});
  }
};
