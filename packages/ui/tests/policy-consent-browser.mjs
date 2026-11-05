// Actual shared consent panel, synthetic responses, installed Chromium; no live credentials.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { openChatBrowser } from './chat-browser-driver.mjs';

const require = createRequire(resolve('src/seller/package.json'));
const ts = require('typescript');
const dependencyRequire = createRequire(require.resolve('react-dom/client'));
function production(name, file) {
  return readFileSync(resolve(dirname(dependencyRequire.resolve(`${name}/package.json`)), 'cjs', file), 'utf8');
}
function compile(file) {
  return ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
const modules = {
  react: production('react', 'react.production.js'),
  'react/jsx-runtime': production('react', 'react-jsx-runtime.production.js'),
  'react-dom': production('react-dom', 'react-dom.production.js'),
  'react-dom/client': production('react-dom', 'react-dom-client.production.js'),
  scheduler: production('scheduler', 'scheduler.production.js'),
  './panel': compile('packages/ui/src/policy-consent/policy-consent-panel.tsx'),
  './use-policy-consent': compile('packages/ui/src/policy-consent/use-policy-consent.ts'),
  './types': compile('packages/ui/src/policy-consent/types.ts'),
};
const artifacts = resolve('node_modules/.cache/policy-consent-browser');
mkdirSync(artifacts, { recursive: true });
const css = Object.fromEntries(['seller', 'admin', 'logistics'].map(role => {
  const assets = resolve(`src/${role}/dist/assets`);
  return [role, readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(assets, name), 'utf8')).join('\n')];
}));
const font = readFileSync('packages/ui/public/fonts/geist-latin.woff2').toString('base64');
const source = `const process={env:{NODE_ENV:'production'}};const sources=${JSON.stringify(modules)},cache={};
function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function('module','exports','require',sources[name])(module,module.exports,require);return module.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),Panel=require('./panel').PolicyConsentPanel;
window.sequence=0;
window.longPolicyContent=true;
window.mount=(role='seller',pending=[true,true],mode='ok')=>{
  window.role=role;window.mode=mode;window.calls=[];window.completed=0;window.reads=0;window.release=null;
  window.current=['terms_of_service','privacy_policy'].map((type,i)=>({type,label:i?'Privacy Policy':'Terms of Service',required:pending[i],accepted:!pending[i],accepted_at:pending[i]?null:'2026-10-01T00:00:00Z',accepted_version:pending[i]?null:{version:1,accepted_at:'2026-10-01T00:00:00Z'},current_version:{id:type+'-1',version:1,change_summary:i?null:'Clarified account responsibilities.',published_at:'2026-11-03T00:00:00Z'}}));
  const current=window.current;
  const snapshot=()=>structuredClone({policies:current,all_required_accepted:current.every(p=>!p.required)});
  const api={status:async()=>{window.reads++;if(window.mode==='readError')throw new Error('Could not load policies.');return {data:snapshot()};},document:async(type)=>{const content=(type==='terms_of_service'?'Terms govern your AISLEY account, purchases and delivery services.':'Privacy describes how AISLEY handles account, purchase and delivery information.')+'\\n\\n<example>Policy text stays plain and readable.</example>\\n\\nReview the complete published document before confirming your acceptance.';return {data:{version:{...current.find(p=>p.type===type).current_version,content:window.longPolicyContent?Array.from({length:40},()=>content).join(' '):content}}};},accept:async(selections)=>{
    window.calls.push(structuredClone(selections));
    if(window.mode==='delayed') await new Promise(resolve=>window.release=resolve);
    if(window.mode==='throttle'){const error=new Error('Too many attempts. Wait before retrying.');error.status=429;error.retryAfter=1;throw error;}
    if(window.mode==='unsaved')throw new Error('The acceptance result is unknown.');
    current.forEach(p=>{if(selections.some(s=>s.type===p.type)){p.required=false;p.accepted=true;p.accepted_at='2026-11-03T01:00:00Z';}});
    if(window.mode==='committed')throw new Error('Response interrupted after saving.');
    return {data:{status:snapshot()}};
  }};
  document.getElementById('role-css').textContent=window.roleCss[role==='customer'?'seller':role];
  document.getElementById('root').className=role==='customer'?'p-4':'portal-shell p-4';
  document.getElementById('root').dataset.role=role;
  root.render(React.createElement(Panel,{key:++window.sequence,api,accent:role==='logistics'?'blue':'purple',onComplete:()=>window.completed++}));
};window.mount(new URLSearchParams(location.search).get('role')||'seller');`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms and Privacy fixture</title><style id="role-css"></style><style>@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font})}body{margin:0;font-family:Geist,system-ui,sans-serif}main{min-height:100vh}</style></head><body><main id="root"></main><script>window.roleCss=${JSON.stringify(css).replaceAll('</script', '<\\/script')};${source.replaceAll('</script', '<\\/script')}</script></body></html>`;
writeFileSync(resolve(artifacts, 'fixture.html'), html);
const browser = await openChatBrowser();
const js = browser.evaluate;
let checks = 0;
async function mount(role = 'seller', pending = [true, true], mode = 'ok') {
  await js(`window.mount(${JSON.stringify(role)},${JSON.stringify(pending)},${JSON.stringify(mode)})`);
  await browser.until("document.querySelectorAll('input[type=checkbox]').length===2 && !document.querySelector('section').getAttribute('aria-busy').includes('true')", 'combined consent ready');
}
async function check(index) { await js(`document.querySelectorAll('input[type=checkbox]')[${index}].click()`); }
async function clickAccept() { await js("document.querySelector('button[type=submit]').click()"); }
try {
  await js(`document.open();document.write(${JSON.stringify(html)});document.close()`);
  await browser.until("document.querySelectorAll('input[type=checkbox]').length===2", 'first render');
  for (const role of ['customer', 'seller', 'admin', 'logistics']) {
    for (const theme of role === 'customer' ? ['light'] : ['light', 'dark']) {
      await mount(role);
      await js(`document.documentElement.classList.toggle('dark',${theme === 'dark'})`);
      for (const width of [320, 390, 768, 1440]) {
        await browser.viewport(width);
        assert(await js('document.documentElement.scrollWidth<=innerWidth'), `${role} ${theme} ${width} overflow`);
        assert.equal(await js("document.querySelectorAll('button[type=submit]').length"), 1);
        assert(await js("document.querySelector('button[type=submit]').disabled"));
        assert(await js("document.querySelectorAll('[role=region][tabindex=\"0\"][aria-labelledby]').length===2"), `${role} ${theme} ${width} has two named scroll regions`);
        assert(await js("[...document.querySelectorAll('[role=region]')].every(el=>el.scrollHeight>el.clientHeight&&getComputedStyle(el).overflowY==='auto')"), `${role} ${theme} ${width} policy text scrolls independently`);
        assert(await js("document.querySelectorAll('[role=region] form').length===0"), `${role} ${theme} ${width} keeps acceptance controls outside the reading regions`);
        if ([390, 1440].includes(width)) {
          await js('scrollTo(0,0)');
          await browser.screenshot(resolve(artifacts, `${role}-${theme}-${width}-reading.png`));
          await js("document.querySelector('form').scrollIntoView({block:'end'})");
          await browser.screenshot(resolve(artifacts, `${role}-${theme}-${width}-confirmation.png`));
        }
        checks++;
      }
      assert(await js("document.body.innerText.includes('<example>Policy text stays plain and readable.</example>')"), 'plain text remains literal');
      await check(0);
      assert(await js("document.querySelector('button[type=submit]').disabled"), 'one checkbox cannot accept both');
      await check(1);
      await browser.until("!document.querySelector('button[type=submit]').disabled", 'both confirmed');
      await clickAccept();
      await browser.until('window.completed===1', 'combined save completion');
      assert.deepEqual(await js('window.calls'), [[{ type: 'terms_of_service', version: 1, confirmation: true }, { type: 'privacy_policy', version: 1, confirmation: true }]]);
      assert(await js("[...document.querySelectorAll('input[type=checkbox]')].every(el=>el.checked&&el.disabled)"));
    }
  }
  await mount('seller');
  await browser.viewport(390);
  await js("document.documentElement.classList.add('dark');window.scrollTo(0,0)");
  const scrollPoints = await js("[...document.querySelectorAll('[role=region]')].map(region=>{const box=region.getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})");
  await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...scrollPoints[0], deltaX: 0, deltaY: 240 });
  await browser.until("document.querySelectorAll('[role=region]')[0].scrollTop>0", 'Terms region wheel scroll');
  assert(await js("document.querySelectorAll('[role=region]')[1].scrollTop===0"), 'scrolling Terms leaves Privacy at its own position');
  await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...scrollPoints[1], deltaX: 0, deltaY: 240 });
  await browser.until("document.querySelectorAll('[role=region]')[1].scrollTop>0", 'Privacy region wheel scroll');
  assert(await js("[...document.querySelectorAll('[role=region]')].every(region=>region.scrollTop>0)"), 'both policy regions scroll independently');

  await mount('seller', [false, true]);
  assert(await js("document.querySelector('input').checked && document.querySelector('input').disabled"));
  await check(1); await clickAccept();
  await browser.until('window.completed===1', 'pending-only completion');
  assert.deepEqual(await js('window.calls[0]'), [{ type: 'privacy_policy', version: 1, confirmation: true }]);

  await mount('admin', [false, false]);
  assert(await js("document.querySelector('button[type=submit]').disabled"));
  assert(await js("document.body.innerText.includes('up to date')"));

  await mount(); await check(0); await check(1);
  await js("window.current[0].current_version.id='terms_of_service-2';window.current[0].current_version.version=2");
  await clickAccept();
  await browser.until("document.body.innerText.includes('version 2')", 'publication refresh');
  assert.equal(await js('window.calls.length'), 0);
  assert(await js("!document.querySelector('input').checked"));
  assert(await js("document.querySelectorAll('input')[1].checked"));
  await check(0); await clickAccept();
  await browser.until('window.completed===1', 'reconfirmed new version');

  for (const mode of ['committed', 'unsaved', 'throttle']) {
    await mount('seller', [true, true], mode); await check(0); await check(1); await clickAccept();
    if (mode === 'committed') {
      await browser.until('window.completed===1', 'uncertain committed result reconciled');
      assert.equal(await js('window.calls.length'), 1);
    } else {
      await browser.until("!!document.querySelector('[role=alert]')", 'recoverable failure');
      assert(await js("[...document.querySelectorAll('input')].every(el=>el.checked)"));
      if (mode === 'throttle') assert(await js("document.querySelector('button[type=submit]').disabled"));
      await js("window.mode='ok'");
      await browser.until("!document.querySelector('button[type=submit]').disabled", 'retry available');
      await clickAccept(); await browser.until('window.completed===1', 'deliberate retry');
      assert.equal(await js('window.calls.length'), 2);
    }
  }
  await mount('seller', [true, true], 'delayed'); await check(0); await check(1); await clickAccept();
  await browser.until('!!window.release', 'save held');
  await clickAccept(); assert.equal(await js('window.calls.length'), 1);
  await js('window.release()'); await browser.until('window.completed===1', 'held save completed');

  await mount('seller', [true, true], 'delayed'); await check(0); await check(1); await clickAccept();
  await browser.until('!!window.release', 'old-account save held');
  await js("window.oldRelease=window.release;window.mount('admin')");
  await browser.until("document.querySelectorAll('input').length===2 && !document.querySelector('section').getAttribute('aria-busy').includes('true')", 'new-account form ready');
  await js('window.oldRelease()');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await js('window.completed'), 0, 'old-account save cannot navigate new account');
  assert(await js("[...document.querySelectorAll('input')].every(el=>!el.checked)"), 'new account receives no confirmations');

  await js("window.mount('seller',[true,true],'readError')");
  await browser.until("!!document.querySelector('[role=alert]')", 'initial read error');
  assert(await js("document.body.innerText.includes('Could not load policies.')"));
  await js("window.mode='ok';[...document.querySelectorAll('button')].find(el=>el.textContent==='Refresh policies').click()");
  await browser.until("document.querySelectorAll('input[type=checkbox]').length===2", 'read retry');
  await browser.viewport(390);
  await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await js("document.activeElement.blur();true");
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert(await js("document.activeElement.matches('[role=region][tabindex=\"0\"]')"), 'keyboard tab order reaches a policy reading region');
  assert.equal(browser.errors.length, 0);
  writeFileSync(resolve(artifacts, 'results.json'), JSON.stringify({ responsiveChecks: checks, longDocumentChecks: checks, workflows: 'initial/combined/pending-only/covered/stale/uncertain/retry/throttle/duplicate/read-recovery/keyboard-focus/independent-scroll', errors: browser.errors }, null, 2));
  console.log(`Passed ${checks} viewport/theme checks and combined-consent workflows; captures: ${artifacts}`);
} finally { await browser.close(); }
