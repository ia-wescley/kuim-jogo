// Grava clipes de gameplay do Kuim (modo demo, o bot joga sozinho) para usar no vídeo do episódio.
// Uso: node grava.js <url-do-jogo> <pasta-de-saida> [clipes=4] [segundos=12] [extra-query]
// Saída: clipe1.mp4..clipeN.mp4 (1080x1920, sem áudio) e quadro1.png..quadroN.png
const {chromium} = require('playwright');
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG = 'E:/Projetos/JaPensou/MoneyPrinterTurbo/.venv/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const [url, saida, nClipes = '4', segs = '12', extra = ''] = process.argv.slice(2);
if (!url || !saida) { console.error('uso: node grava.js <url> <pasta> [clipes] [segundos] [extra-query]'); process.exit(1); }

(async () => {
  fs.mkdirSync(saida, {recursive: true});
  const tmp = path.join(saida, '_webm');
  fs.mkdirSync(tmp, {recursive: true});
  const nav = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  for (let i = 1; i <= Number(nClipes); i++) {
    const ctx = await nav.newContext({viewport: {width: 540, height: 960}, recordVideo: {dir: tmp, size: {width: 540, height: 960}}});
    const pag = await ctx.newPage();
    const sep = url.includes('?') ? '&' : '?';
    await pag.goto(`${url}${sep}demo=1&seed=${i * 11}${extra ? '&' + extra : ''}`, {waitUntil: 'load'});
    await pag.waitForTimeout(3000); // descarta o carregamento (cortado no ffmpeg)
    await pag.waitForTimeout(Number(segs) * 500);
    await pag.screenshot({path: path.join(saida, `quadro${i}.png`)});
    await pag.waitForTimeout(Number(segs) * 500);
    const video = pag.video();
    await ctx.close();
    const webm = await video.path();
    const mp4 = path.join(saida, `clipe${i}.mp4`);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '3.2', '-i', webm, '-t', segs,
      '-vf', 'scale=1080:1920:flags=lanczos,fps=30', '-an', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', mp4]);
    console.log('ok', mp4);
  }
  await nav.close();
  fs.rmSync(tmp, {recursive: true, force: true});
})().catch(e => { console.error(e); process.exit(1); });
