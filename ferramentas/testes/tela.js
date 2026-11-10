// Teste rápido: abre o jogo em modo demo, junta erros do console e tira screenshots.
// Uso: node testes/tela.js <url> <pasta> <tempos-em-s separados por vírgula>
const {chromium} = require('playwright'); const path = require('path'); const fs = require('fs');
const [url, saida, tempos = '2,5,8'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(saida, {recursive: true});
  const nav = await chromium.launch(); const pag = await nav.newPage({viewport: {width: 540, height: 960}});
  const erros = []; pag.on('pageerror', e => erros.push(e.message)); pag.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await pag.goto(url); let t0 = 0;
  for (const t of tempos.split(',').map(Number)) { await pag.waitForTimeout((t - t0) * 1000); t0 = t; await pag.screenshot({path: path.join(saida, `t${t}.png`)}); }
  console.log('erros:', JSON.stringify(erros)); await nav.close();
})();
