// Chụp app web (Expo dev server) ở khổ điện thoại bằng Chrome headless + DevTools Protocol.
// Cần: `npx expo start` đang chạy (web ở http://localhost:8081) và Chrome cài sẵn.
// VD: node scripts/preview-shots.js shots "url:http://localhost:8081" "waitfor:AI tạo lộ trình ngay" "shot:brief" "click:✨ AI tạo lộ trình ngay" "waitfor:Lộ trình" "wait:3000" "shot:plan"
// Bước: url:<url> | wait:<ms> | waitfor:<chữ> | click:<chữ đầu nút> | scrollto:<chữ> | text | shot:<tên>
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [outDir, ...steps] = process.argv.slice(2);
const PORT = 9333;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page'); }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  await send('Page.enable');
  for (const step of steps) {
    const [kind, ...rest] = step.split(':');
    const arg = rest.join(':');
    if (kind === 'url') { await send('Page.navigate', { url: arg }); await new Promise((r) => setTimeout(r, 1500)); }
    if (kind === 'wait') await new Promise((r) => setTimeout(r, Number(arg)));
    if (kind === 'waitfor') {
      for (let i = 0; i < 120; i++) { if (await evalJs(`document.body.innerText.includes(${JSON.stringify(arg)})`)) break; await new Promise((r) => setTimeout(r, 500)); }
    }
    if (kind === 'click') {
      const ok = await evalJs(`(() => { const t=${JSON.stringify(arg)}; const els=[...document.querySelectorAll('div,span,a,button')].filter(e=>e.innerText&&e.innerText.trim().startsWith(t)); const el=els.sort((a,b)=>a.innerText.length-b.innerText.length)[0]; if(!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`);
      console.log('click', arg, ok);
      await new Promise((r) => setTimeout(r, 600));
    }
    if (kind === 'scrollto') {
      await evalJs(`(() => { const t=${JSON.stringify(arg)}; const els=[...document.querySelectorAll('div')].filter(e=>e.innerText&&e.innerText.trim().startsWith(t)); const el=els.sort((a,b)=>a.innerText.length-b.innerText.length)[0]; if(el) el.scrollIntoView({block:'start'}); })()`);
      await new Promise((r) => setTimeout(r, 600));
    }
    if (kind === 'type') {
      // type:<chữ đầu placeholder>|<nội dung>  — gõ vào TextInput (react-native-web) như người dùng thật.
      const [ph, ...v] = arg.split('|');
      const ok = await evalJs(`(() => { const el=[...document.querySelectorAll('input,textarea')].find(e=>(e.placeholder||'').startsWith(${JSON.stringify(ph)})); if(!el) return false; el.scrollIntoView({block:'center'}); el.focus(); const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el, ${JSON.stringify(v.join('|'))}); el.dispatchEvent(new Event('input',{bubbles:true})); el.blur(); return true; })()`);
      console.log('type', ph, ok);
      await new Promise((r) => setTimeout(r, 500));
    }
    if (kind === 'text') console.log(await evalJs('document.body.innerText.slice(0, 1500)'));
    if (kind === 'shot') {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `${arg}.png`), Buffer.from(r.result.data, 'base64'));
      console.log('saved', arg);
    }
  }
  ws.close(); chrome.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
