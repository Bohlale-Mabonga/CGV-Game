// Captures the trailer: node trailer.mjs <outDir> [fromFrame] [toFrame] [step] [--audio]
import fs from 'node:fs';
import path from 'node:path';
const [outDir, from = '0', to = '-1', stepArg = '1'] = process.argv.slice(2);
const wantAudio = process.argv.includes('--audio');
fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') console.log('[EXC]', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.log('[err]', m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.result.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:4173/?trailer' });
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try { if (await evaluate('!!window.__trailerReady')) break; } catch {}
}
const total = await evaluate('__trailer.frames');
const end = Number(to) < 0 ? total : Math.min(total, Number(to));
const step = Number(stepArg);
const t0 = Date.now();
for (let i = Number(from); i < end; i += step) {
  await evaluate(`__trailer.frame(${i})`);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  fs.writeFileSync(path.join(outDir, 'frames', `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'));
  if (i % 150 === 0) console.log(`frame ${i}/${end}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
if (wantAudio) {
  const len = await evaluate('__trailer.renderAudio()');
  const size = 3 * 1024 * 1024;
  const parts = [];
  for (let c = 0; c * size < len; c++) parts.push(Buffer.from(await evaluate(`__trailer.audioChunk(${c}, ${size})`), 'base64'));
  fs.writeFileSync(path.join(outDir, 'music.wav'), Buffer.concat(parts));
  console.log('audio bytes', len);
}
console.log('done');
ws.close();
process.exit(0);
