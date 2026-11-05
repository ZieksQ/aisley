// Minimal Chromium CDP driver for the isolated account settings interaction test.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export async function openBrowser() {
  const executable = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => path && existsSync(path));
  if (!executable) throw new Error('Set CHROME_PATH to an installed Chromium executable.');
  const profile = resolve('node_modules/.cache/account-settings-browser', `profile-${process.pid}`);
  mkdirSync(profile, { recursive: true });
  const proc = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chromium did not start.')), 20000);
    let output = '';
    proc.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); done(match[1]); }
    });
    proc.once('exit', () => { clearTimeout(timeout); reject(new Error(output.slice(-1000))); });
  });
  const socket = new WebSocket(endpoint);
  await new Promise((done) => socket.addEventListener('open', done, { once: true }));
  let serial = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.description ?? arg.value).join(' '));
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (!message.id) return;
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id); clearTimeout(call.timer);
    if (message.error) call.reject(new Error(message.error.message));
    else call.done(message.result);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((done, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(id, { done, reject, timer });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  return {
    errors,
    async page() {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const cdp = (method, params) => send(method, params, sessionId);
      await cdp('Page.enable'); await cdp('Runtime.enable');
      return {
        cdp,
        async evaluate(expression) {
          const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
          return result.result.value;
        },
        async viewport(width) {
          await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        },
        async close() { await send('Target.closeTarget', { targetId }); },
      };
    },
    async close() {
      try { await send('Browser.close'); } catch { /* The process may close the socket first. */ }
      for (const call of pending.values()) clearTimeout(call.timer);
      socket.close(); proc.kill();
      await pause(300);
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    },
  };
}
