import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {openChatBrowser} from './chat-browser-driver.mjs';
import {installChatFixture} from './chat-app-fixture.mjs';
function installMedia() {
 const state=window.chatAppFixture; state.uploadFails=true;state.processing=false;state.uploads=[];state.removes=0;
 const asset={id:'a0000000-0000-4000-8000-000000000001',kind:'image',filename:'photo.png',mime_type:'image/png',byte_size:68,state:'ready',error_code:null,width:1,height:1,duration_seconds:null,content_url:null,preview_url:null};
 const originalFetch=window.fetch;
 window.fetch=async(input,options={})=>{const path=new URL(input instanceof Request?input.url:String(input),location.origin).pathname;
 if(path.includes('/chat-attachments')) {if(options.method==='DELETE')state.removes++;return new Response(JSON.stringify({data:path.endsWith('/chat-attachments')?{enabled:true}:{...asset,state:state.processing?'pending':'ready'}}),{status:200,headers:{'Content-Type':'application/json'}})}
 return originalFetch(input,options);
 };
 const OriginalXHR=window.XMLHttpRequest;
 window.XMLHttpRequest=class extends OriginalXHR {
  open(method,url,...rest){this.mock=String(url).includes('/chat-attachments');if(!this.mock)return super.open(method,url,...rest)}
  setRequestHeader(name,value){if(this.mock){this.headers??={};this.headers[name]=value}else super.setRequestHeader(name,value)}
  get status(){return this.mockStatus??super.status}
  get responseText(){return this.mockResponse??super.responseText}
  send(data){if(!this.mock)return super.send(data);state.uploads.push({key:this.headers['Idempotency-Key'],context:data.get('context')});setTimeout(()=>{this.mockStatus=state.uploadFails?503:201;this.mockResponse=JSON.stringify(state.uploadFails?{message:'Independent synthetic upload failed'}:{data:{...asset,state:state.processing?'pending':'ready'}});this.dispatchEvent(new Event('load'));this.dispatchEvent(new Event('loadend'));},400)}
  abort(){if(!this.mock)return super.abort();this.dispatchEvent(new Event('abort'));this.dispatchEvent(new Event('loadend'))}
 };
}
const browser=await openChatBrowser();const {evaluate:js,until,cdp}=browser;
const id='20000000-0000-4000-8000-000000000001';
const out=resolve('docs/loop/messages-ui-ux-20261011/screenshots');const file=resolve('node_modules/.cache/messages-ui/verifier-02/photo.png');
writeFileSync(file,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
const submit=`document.querySelector('form button[type=submit]')`;const checks=[];let injection;
async function picker(){const doc=await cdp('DOM.getDocument');const {nodeId}=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'});await cdp('DOM.setFileInputFiles',{nodeId,files:[file]})}
async function reachable(selector){await js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);await new Promise(done=>setTimeout(done,100));const geometry=await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);let parents=[];for(let p=el.parentElement;p;p=p.parentElement){const q=p.getBoundingClientRect(),c=getComputedStyle(p);if(c.overflowY!=='visible')parents.push({tag:p.tagName,cls:p.className,height:p.clientHeight,scroll:p.scrollHeight,top:q.top,bottom:q.bottom,overflow:c.overflowY})}return {r:{top:r.top,bottom:r.bottom,x:r.x,width:r.width,height:r.height},hit:hit?{tag:hit.tagName,text:hit.textContent.slice(0,100)}:null,clickable:hit===el||el.contains(hit),parents}})()`);console.log(JSON.stringify({url:await js('location.href'),selector,geometry}));assert.equal(geometry.clickable,true,selector+' visible hit target'); return {x:geometry.r.x+geometry.r.width/2,y:(geometry.r.top+geometry.r.bottom)/2};}
async function click(selector){const point=await reachable(selector);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
try{
 for(const [role,origin,path]of [['seller','http://127.0.0.1:15174',`/messages/${id}`],['logistics','http://127.0.0.1:15176',`/messages?conversation=${id}`],['customer','http://127.0.0.1:15300',`/messages/${id}`],['customer','http://127.0.0.1:15300',`/delivery-messages?conversation=${id}`],['customer','http://127.0.0.1:15300',`/courier-messages?conversation=${id}`],['seller','http://127.0.0.1:15174',`/logistics-messages?conversation=${id}`],['seller','http://127.0.0.1:15174',`/courier-messages?conversation=${id}`]]){
  if(process.env.CHAT_BROWSER_ROLES&&!process.env.CHAT_BROWSER_ROLES.split(',').includes(role))continue;
  if(injection)await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection});
  ({identifier:injection}=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(${installChatFixture.toString()})(${JSON.stringify(role)});(${installMedia.toString()})();`}));
  await browser.viewport(320,500);await browser.navigate(origin+path);await until(`Boolean(document.querySelector('input[type=file]'))`,role+' picker');
  await js(`document.querySelector('summary').focus()`);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(`document.querySelector('details').open`,'keyboard file-limit disclosure');
  assert.equal(await js(`document.querySelector('details').open`),true,'keyboard file-limit disclosure');await js(`document.querySelector('details').open=false`);
  await picker();await until(`Boolean(document.querySelector('ul[aria-label="Selected attachments"]'))`,role+' selected');assert.equal(await js(`${submit}.disabled`),true);
  await until(`document.body.innerText.includes('Independent synthetic upload failed')`,role+' file error');assert.equal(await js(`${submit}.disabled`),true);
  await reachable('button[aria-label^="Remove "]');await browser.screenshot(resolve(out,`03-${role}-${path.split("?")[0].replaceAll("/", "_")}-media-error-short.png`));
  await js(`window.chatAppFixture.uploadFails=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry file').dataset.testRetry='true'`);await click('button[data-test-retry]');await until(`!${submit}.disabled`,role+' ready');
  assert.equal(await js(`window.chatAppFixture.uploads[0].key===window.chatAppFixture.uploads[1].key`),true,'upload exact retry identity');
  await click('button[aria-label^="Remove "]');await until(`!document.querySelector('ul[aria-label="Selected attachments"]')`,role+' remove');assert.equal(await js(`${submit}.disabled`),true);
  await js(`window.chatAppFixture.processing=true`);await picker();
  await until(`document.body.innerText.includes('Checking file…')`,role+' processing');
  assert.equal(await js(`${submit}.disabled`),true);await browser.viewport(320,500);
  await reachable('button[aria-label^="Remove "]');await click('button[aria-label^="Remove "]');
  await js(`window.chatAppFixture.processing=false`);
  await picker();await until(`!${submit}.disabled`,role+' attachment-only ready');
  for(const [w,h]of [[320,500],[390,500]]){await browser.viewport(w,h);await new Promise(done=>setTimeout(done,200));assert.equal(await js(`document.documentElement.scrollWidth<=innerWidth+1`),true);await reachable('button[aria-label^="Remove "]');await reachable('form button[type=submit]');await browser.screenshot(resolve(out,`03-${role}-${path.split("?")[0].replaceAll("/", "_")}-media-ready-${w}x${h}.png`))}
  await js(`window.chatAppFixture.loseResponse=true;${submit}.click()`);await until(`${submit}.textContent==='Retry'`,role+' attachment uncertainty');assert.equal(await js(`document.querySelector('textarea').disabled&&document.querySelector('button[aria-label^="Remove "]').disabled`),true);
  await reachable('form button[type=submit]');await browser.screenshot(resolve(out,`03-${role}-${path.split("?")[0].replaceAll("/", "_")}-media-uncertain-short.png`));await js(`${submit}.click()`);await until(`window.chatAppFixture.sends.length===2&&!document.querySelector('ul[aria-label="Selected attachments"]')`,role+' confirmed replay');
  const sends=await js(`window.chatAppFixture.sends`);assert.deepEqual(sends[0],sends[1]);assert.equal(sends[0].input.body,'');assert.deepEqual(sends[0].input.attachment_ids,['a0000000-0000-4000-8000-000000000001']);assert.equal(await js(`window.chatAppFixture.messages.filter(m=>m.body==='').length`),1);
  await picker();await until(`!${submit}.disabled`,role+' private ready');await js(`window.chatAppFixture.deny=true;window.dispatchEvent(new Event('focus'))`);await until(`!document.querySelector('ul[aria-label="Selected attachments"]')`,role+' denial cleanup');
  checks.push(role+': disclosure keyboard; upload failure/gating/exact upload retry/remove; ready media320+short; attachment-only exact key/IDs replay one committed message; locked uncertainty; denial clears files');
 }
 assert.equal(browser.errors.length,0);writeFileSync(resolve(out,'03-media-results.json'),JSON.stringify({status:'passed',checks},null,2));console.log(JSON.stringify({status:'passed',checks}));
} catch(e){console.error(await js(`({url:location.href,text:document.body.innerText.slice(-1800)})`).catch(()=>null));throw e}finally{browser.close()}
