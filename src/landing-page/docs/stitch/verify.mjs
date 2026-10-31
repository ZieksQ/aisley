import {writeFileSync} from 'node:fs';
const tabs=await(await fetch('http://127.0.0.1:9333/json')).json();
const ws=new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const waiting=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){waiting.get(m.id)?.(m.result);waiting.delete(m.id);}};
const call=(method,params={})=>new Promise(r=>{waiting.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
await call('Page.enable');await call('Page.navigate',{url:'http://localhost:4321'});await call('Runtime.evaluate',{expression: `Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{});} ))`,awaitPromise:true});await new Promise(r=>setTimeout(r,1000));
const results=[];
for(const width of [320,390,768,1024,1440]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 await new Promise(r=>setTimeout(r,150));
 const check=await call('Runtime.evaluate',{expression:`JSON.stringify({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].filter(i=>i.getAttribute("src")).every(i=>i.complete&&i.naturalWidth>0),h1:document.querySelectorAll('h1').length,faq:document.querySelectorAll('details').length})`,returnByValue:true});results.push(JSON.parse(check.result.value));
 if([390,1440].includes(width)){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});writeFileSync('src/landing-page/docs/stitch/implemented-'+width+'.png',Buffer.from(shot.data,'base64'));}
}
const dialog=await call('Runtime.evaluate',{expression:`document.querySelector('[data-preview]').click(); JSON.stringify({open:document.querySelector('dialog').open})`,returnByValue:true});results.push(JSON.parse(dialog.result.value));
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
console.log(JSON.stringify(results,null,2));writeFileSync('src/landing-page/docs/stitch/verification.json',JSON.stringify(results,null,2));ws.close();
