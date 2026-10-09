// Real Courier upload/send and Customer private reads on the isolated chat fixture API.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const directory = resolve('src/api/storage/framework/testing/chat-browser');
const fixture = JSON.parse(await readFile(`${directory}/fixture.json`, 'utf8'));
const origin = process.env.CHAT_BROWSER_API ?? 'http://localhost:18000';
const courier = { Authorization: `Bearer ${fixture.courier_token}`, Accept: 'application/json' };
const ids = [];
for (const [filename, type] of [['photo.png', 'image/png'], ['clip.mp4', 'video/mp4'], ['details.pdf', 'application/pdf']]) {
  const form = new FormData();
  form.set('file', new Blob([await readFile(`${directory}/${filename}`)], { type }), filename);
  form.set('context', JSON.stringify({ conversation_id: fixture.customer_courier }));
  const key = randomUUID();
  const uploaded = await fetch(`${origin}/api/v1/courier/chat-attachments`, { method: 'POST', headers: { ...courier, 'Idempotency-Key': key }, body: form });
  assert.equal(uploaded.status, 201);
  let asset = (await uploaded.json()).data;
  assert.equal(asset.content_url, null);
  const deadline = Date.now() + 30000;
  while (asset.state === 'pending' && Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 1000));
    const response = await fetch(`${origin}/api/v1/courier/chat-attachments/${asset.id}`, { headers: courier });
    assert.equal(response.status, 200);
    asset = (await response.json()).data;
  }
  assert.equal(asset.state, 'ready');
  ids.push(asset.id);
}
const key = randomUUID();
const send = () => fetch(`${origin}/api/v1/courier/operational-conversations/${fixture.customer_courier}/messages`, {
  method: 'POST', headers: { ...courier, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ attachment_ids: ids }),
});
const sent = await send();
assert.equal(sent.status, 201);
const message = (await sent.json()).message;
assert.equal(message.body, 'Sent 3 attachments');
assert.deepEqual(message.attachments.map((asset) => asset.id), ids);
const replay = await send();
assert.equal(replay.status, 200);
assert.equal((await replay.json()).message.id, message.id);
const login = await fetch(`${origin}/api/v1/customer/auth/login`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'chat-customer@example.test', password: 'Chat-browser-password-123!', device_name: 'isolated-chat-media-verification' }) });
assert.equal(login.status, 200);
const customer = { Authorization: `Bearer ${(await login.json()).token}`, Accept: 'application/json' };
const history = await fetch(`${origin}/api/v1/customer/courier-conversations/${fixture.customer_courier}/messages`, { headers: customer });
assert.equal(history.status, 200);
const received = (await history.json()).data.find((item) => item.id === message.id);
assert.equal(received.mine, false);
for (const asset of received.attachments) {
  assert.ok(asset.content_url.startsWith('/api/v1/customer/'));
  const response = await fetch(origin + asset.content_url, { headers: { ...customer, ...(asset.kind === 'video' ? { Range: 'bytes=0-31' } : {}) } });
  assert.equal(response.status, asset.kind === 'video' ? 206 : 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('content-type'), asset.mime_type);
  if (asset.kind === 'document') assert.ok(response.headers.get('content-disposition').startsWith('attachment;'));
  assert.ok((await response.arrayBuffer()).byteLength > 0);
}
console.log('Passed real scoped Courier image/video/PDF upload, checking, attachment-only send/replay and Customer bearer history/private bytes.');
