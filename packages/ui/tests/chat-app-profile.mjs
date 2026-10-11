import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { openChatBrowser } from './chat-browser-driver.mjs';
import { installChatFixture } from './chat-app-fixture.mjs';

const browser = await openChatBrowser();
const { evaluate: js, until, cdp } = browser;
const origin = 'http://127.0.0.1:15300';
const id = '20000000-0000-4000-8000-000000000001';
const shop = '40000000-0000-4000-8000-000000000001';
const checks = [];
async function click(selector) {
  await js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
  const point = await js(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`);
  assert.equal(point.hit, true, selector+' hit target');
  const {x,y}=point;
  for (const type of ['mousePressed','mouseReleased']) await cdp('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});
}
try {
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(${installChatFixture.toString()})('customer')`});
  await browser.navigate(origin+`/messages/${id}`);
  await until(`Boolean(document.querySelector('button[aria-label="View Maya Shop profile"]'))`,'Shop profile trigger');
  for (const [w,h] of [[320,500],[390,850],[1440,850]]) {
    await browser.viewport(w,h);
    await click('button[aria-label="View Maya Shop profile"]');
    await until(`document.querySelector('dialog').open`,'profile open');
    assert.equal(await js(`document.querySelector('dialog a').getAttribute('href')`),'/shops/maya');
    assert.equal(await js(`(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`),true);
    assert.equal(await js(`document.activeElement.getAttribute('aria-label')`),'Close profile');
    await browser.screenshot(resolve('docs/loop/messages-ui-ux-20261011/screenshots',`03-customer-profile-${w}x${h}.png`));
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until(`!document.querySelector('dialog').open`,'Escape closes');
    assert.equal(await js(`document.activeElement.getAttribute('aria-label')`),'View Maya Shop profile');
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await until(`document.querySelector('dialog').open`,'keyboard opens');
    await click('button[aria-label="Close profile"]');
    await click('button[aria-label="View Maya Shop profile"]');
    for (const type of ['mousePressed','mouseReleased']) await cdp('Input.dispatchMouseEvent',{type,x:1,y:1,button:'left',clickCount:1});
    await until(`!document.querySelector('dialog').open`,'outside dismisses');
  }
  checks.push('Customer profile: responsive floating card, safe View shop, pointer/keyboard/Escape/Close/focus restoration');
  for(const [availability,label] of [['vacation','On vacation'],['offline','Shop offline'],['online','Shop online']]) {
    await js(`window.chatAppFixture.availability=${JSON.stringify(availability)};window.dispatchEvent(new Event('focus'))`);
    await until(`document.body.innerText.includes(${JSON.stringify(label)})`,label);
  }
  await js(`window.chatAppFixture.omitAvailability=true;window.dispatchEvent(new Event('focus'))`);
  await until(`!document.body.innerText.includes('Shop online')&&!document.body.innerText.includes('Shop offline')&&!document.body.innerText.includes('On vacation')`,'legacy availability is not guessed');
  checks.push('Shop availability labels follow server states; absent legacy field is not guessed');
  await browser.navigate(origin+`/messages/new?shop=${shop}&product=10000000-0000-4000-8000-000000000001`);
  await until(`location.pathname==='/messages'&&document.body.innerText.includes('Product · Linen shirt')&&!document.querySelector('textarea').disabled`,'legacy entry keeps product context');
  await js(`document.querySelector('textarea').focus()`);
  await cdp('Input.insertText',{text:'Product question'});
  await click('form button[type=submit]');
  await until(`location.pathname==='/messages/${id}'`,'context send opens thread');
  assert.equal(await js(`window.chatAppFixture.sends[0].input.context_type`),'product');
  checks.push('Legacy redirect retains Product context and commits through chat workspace');
  await browser.viewport(390,500);
  await browser.navigate(origin+`/messages?shop=${shop}&product=10000000-0000-4000-8000-000000000001`);
  await until(`document.body.innerText.includes('Product · Linen shirt')&&!document.querySelector('textarea').disabled`,'removable prospective context');
  await js(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Remove').dataset.contextRemove='true'`);
  await click('button[data-context-remove]');
  await js(`document.querySelector('textarea').focus();window.chatAppFixture.loseResponse=true`);
  await cdp('Input.insertText',{text:'Shop question without context'});
  await click('form button[type=submit]');
  await until(`document.querySelector('form button[type=submit]').textContent==='Retry'`,'unconfirmed context-free first send');
  await js(`window.chatAppFixture.existingShop=true`);
  await click('section[aria-label="Conversation"] > button');
  await until(`location.pathname==='/messages'&&!location.search`,'temporary inbox navigation');
  await js(`history.back()`);
  await until(`Boolean(document.querySelector('#first-message'))&&document.querySelector('form button[type=submit]').textContent==='Retry'`,'unconfirmed start restored');
  assert.equal(await js(`document.querySelector('textarea').value`),'Shop question without context');
  assert.equal(await js(`document.body.innerText.includes('Product · Linen shirt')`),false);
  await click('form button[type=submit]');
  await until(`location.pathname==='/messages/${id}'`,'restored exact first-send recovery');
  assert.deepEqual(await js(`window.chatAppFixture.sends[0]`),await js(`window.chatAppFixture.sends[1]`));
  assert.equal(await js(`window.chatAppFixture.messages.filter(message=>message.body==='Shop question without context').length`),1);
  checks.push('SPA return preserves removed context and exact uncertain first-send key/body without premature redirect');
  assert.equal(browser.errors.length,0);
  console.log(JSON.stringify({status:'passed',checks}));
} finally {browser.close()}
