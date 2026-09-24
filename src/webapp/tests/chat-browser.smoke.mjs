// Run only against disposable local fixtures and locally started API, storefront, and Seller servers.
const shopId = process.env.CHAT_BROWSER_SHOP_ID;
const password = process.env.CHAT_BROWSER_PASSWORD;
const orderId = process.env.CHAT_BROWSER_ORDER_ID;
if (!shopId || !password) throw new Error('CHAT_BROWSER_SHOP_ID and CHAT_BROWSER_PASSWORD are required.');

const driver = 'http://127.0.0.1:9515';

async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`);
  return payload.value;
}

async function browser(width) {
  const session = await command('POST', '/session', {
    capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': {
      args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--window-size=${width},850`],
    } } },
  });
  const path = `/session/${session.sessionId}`;
  return {
    go: (url) => command('POST', `${path}/url`, { url }),
    js: (script, args = []) => command('POST', `${path}/execute/sync`, { script, args }),
    element: async (selector) => {
      const element = await command('POST', `${path}/element`, { using: 'css selector', value: selector });
      return element['element-6066-11e4-a52e-4f735466cecf'];
    },
    type: async (selector, value) => {
      const id = await command('POST', `${path}/element`, { using: 'css selector', value: selector });
      const key = id['element-6066-11e4-a52e-4f735466cecf'];
      await command('POST', `${path}/element/${key}/value`, { text: value });
    },
    click: async (selector) => {
      const id = await command('POST', `${path}/element`, { using: 'css selector', value: selector });
      const key = id['element-6066-11e4-a52e-4f735466cecf'];
      await command('POST', `${path}/element/${key}/click`, {});
    },
    cdp: (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params }),
    close: () => command('DELETE', path),
  };
}

async function until(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const customer = await browser(390);
const seller = await browser(390);
const logistics = orderId ? await browser(1200) : null;
try {
  const startUrl = `http://127.0.0.1:3000/messages/new?shop=${encodeURIComponent(shopId)}`;
  await customer.go(`http://127.0.0.1:3000/login?next=${encodeURIComponent(`/messages/new?shop=${shopId}`)}`);
  await until(() => customer.js('return Boolean(document.querySelector("input[name=email]"))'), 'Customer login form');
  await customer.type('input[name=email]', 'chat-customer@test.local');
  await customer.type('input[name=password]', password);
  await customer.click('form:has(input[name=email]) button[type=submit]');
  await until(() => customer.js('return location.pathname === "/messages/new" && Boolean(document.querySelector("#first-message"))'), 'Customer new-message form');
  await customer.type('#first-message', 'Browser hello <script>plain text</script>');
  await customer.click('form:has(#first-message) button[type=submit]');
  await until(() => customer.js('return location.pathname.startsWith("/messages/") && location.pathname !== "/messages/new" && document.body.innerText.includes("Browser hello")'), 'Customer committed thread');
  const threadUrl = await customer.js('return location.href');
  const renderedText = await customer.js('return [...document.querySelectorAll("ol li p")].map(p => p.textContent).find(t => t?.includes("Browser hello"))');
  if (renderedText !== 'Browser hello <script>plain text</script>') throw new Error('Customer message was not rendered as plain text.');
  const viewport = await customer.js('return document.documentElement.scrollWidth <= innerWidth + 2');
  if (!viewport) throw new Error('Customer thread overflows a 390px viewport.');

  await seller.go('http://127.0.0.1:5174/login');
  await until(() => seller.js('return Boolean(document.querySelector("#email"))'), 'Seller login form');
  await seller.type('#email', 'chat-seller@test.local');
  await seller.type('#password', password);
  await seller.click('form:has(#email) button[type=submit]');
  await until(() => seller.js('return location.pathname === "/dashboard"'), 'Seller dashboard');
  await seller.go('http://127.0.0.1:5174/messages');
  await until(() => seller.js('return document.body.innerText.includes("Browser hello")'), 'Seller inbox');
  await seller.click('a[href^="/messages/"]');
  await until(() => seller.js('return Boolean(document.querySelector("#seller-chat-message"))'), 'Seller thread');
  if (!(await seller.js('return document.documentElement.scrollWidth <= innerWidth + 2'))) throw new Error('Seller thread overflows a 390px viewport.');
  await seller.type('#seller-chat-message', 'Browser seller reply');
  await seller.click('form:has(#seller-chat-message) button[type=submit]');
  await until(() => seller.js('return document.body.innerText.includes("Browser seller reply")'), 'Seller committed reply');
  await until(() => seller.js('return document.querySelector("#seller-chat-message")?.disabled === false'), 'Seller composer ready');
  await seller.cdp('Network.enable');
  await seller.cdp('Network.emulateNetworkConditions', { offline: false, latency: 20000, downloadThroughput: -1, uploadThroughput: -1 });
  await seller.type('#seller-chat-message', 'Browser seller timeout retry');
  await seller.click('form:has(#seller-chat-message) button[type=submit]');
  await until(() => seller.js('return document.body.innerText.includes("Message delivery was not confirmed")'), 'Seller uncertain timeout', 22000);
  if (!(await seller.js('return document.querySelector("#seller-chat-message")?.value === "Browser seller timeout retry"'))) throw new Error('Seller timed-out draft was lost.');
  await seller.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await until(() => seller.js('return document.querySelector("form:has(#seller-chat-message) button[type=submit]")?.disabled === false'), 'Seller retry ready');
  await seller.click('form:has(#seller-chat-message) button[type=submit]');
  await until(() => seller.js('return document.body.innerText.includes("Browser seller timeout retry") && document.querySelector("#seller-chat-message")?.value === ""'), 'Seller timeout retry committed');

  await customer.go(threadUrl);
  await until(() => customer.js('return document.body.innerText.includes("Browser seller reply")'), 'Customer refreshed reply');
  await customer.cdp('Network.enable');
  await customer.cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await customer.type('#chat-message', 'Browser offline retry');
  await customer.click('form:has(#chat-message) button[type=submit]');
  await until(() => customer.js('return Boolean(document.querySelector("form [role=alert]")) || document.body.innerText.includes("Your connection may be unavailable")'), 'offline error');
  if (!(await customer.js('return document.querySelector("#chat-message")?.value === "Browser offline retry"'))) throw new Error('Offline draft was lost.');
  await customer.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await customer.click('form:has(#chat-message) button[type=submit]');
  await until(() => customer.js('return document.body.innerText.includes("Browser offline retry") && document.querySelector("#chat-message")?.value === ""'), 'retry committed');
  await until(() => customer.js('return document.querySelector("#chat-message")?.disabled === false'), 'Customer composer ready');
  await seller.js('window.dispatchEvent(new Event("online")); return true');
  await until(() => seller.js('return document.body.innerText.includes("Browser offline retry")'), 'Seller reconnect refresh');

  await customer.cdp('Network.emulateNetworkConditions', { offline: false, latency: 20000, downloadThroughput: -1, uploadThroughput: -1 });
  await customer.type('#chat-message', 'Browser timeout retry');
  await customer.click('form:has(#chat-message) button[type=submit]');
  await until(() => customer.js('return document.body.innerText.includes("Message delivery was not confirmed")'), 'uncertain timeout', 22000);
  if (!(await customer.js('return document.querySelector("#chat-message")?.value === "Browser timeout retry"'))) throw new Error('Timed-out draft was lost.');
  await customer.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await until(() => customer.js('return document.querySelector("form:has(#chat-message) button[type=submit]")?.disabled === false'), 'Customer retry ready');
  await customer.click('form:has(#chat-message) button[type=submit]');
  await until(() => customer.js('return document.body.innerText.includes("Browser timeout retry") && document.querySelector("#chat-message")?.value === ""'), 'timeout retry committed');

  if (orderId && logistics) {
    await customer.go(`http://127.0.0.1:3000/delivery-messages?order=${encodeURIComponent(orderId)}`);
    await until(() => customer.js('return Boolean(document.querySelector("#delivery-message"))'), 'Customer delivery composer');
    await customer.type('#delivery-message', 'Where is my delivery?');
    await customer.click('form:has(#delivery-message) button[type=submit]');
    await until(() => customer.js('return location.search.includes("conversation=") && document.body.innerText.includes("Where is my delivery?")'), 'Customer delivery message');

    await logistics.go('http://127.0.0.1:5176/login');
    await until(() => logistics.js('return Boolean(document.querySelector("#email"))'), 'Logistics login form');
    await logistics.type('#email', 'chat-logistics@test.local');
    await logistics.type('#password', password);
    await logistics.click('form:has(#email) button[type=submit]');
    await until(() => logistics.js('return location.pathname === "/dashboard"'), 'Logistics dashboard');
    await logistics.go('http://127.0.0.1:5176/messages');
    await until(() => logistics.js('return document.body.innerText.includes("Where is my delivery?")'), 'Logistics operational inbox');
    await logistics.click('aside[aria-label="Conversation inbox"] li button');
    await until(() => logistics.js('return Boolean(document.querySelector("#courier-message"))'), 'Logistics order thread');
    await logistics.type('#courier-message', 'Your parcel is at our hub.');
    await logistics.click('form:has(#courier-message) button[type=submit]');
    await until(() => logistics.js('return document.body.innerText.includes("Your parcel is at our hub.")'), 'Logistics delivery reply');

    await customer.js('window.dispatchEvent(new Event("focus")); return true');
    await until(() => customer.js('return document.body.innerText.includes("Your parcel is at our hub.")'), 'Customer delivery reply on focus');
  }

  console.log(JSON.stringify({ result: 'passed', checks: ['Customer login/start/plain text', '390px viewport', 'Seller login/inbox/reply', 'Customer refresh', 'offline draft/retry', 'Customer/Seller timeout draft/retry', ...(orderId ? ['Customer–Logistics order chat/reply/focus'] : [])], startUrl }));
} catch (error) {
  console.error(JSON.stringify({ customerUrl: await customer.js('return location.href').catch(() => null),
    customerText: await customer.js('return document.body.innerText.slice(-1200)').catch(() => null),
    sellerUrl: await seller.js('return location.href').catch(() => null),
    sellerText: await seller.js('return document.body.innerText.slice(-1200)').catch(() => null),
    logisticsText: await logistics?.js('return document.body.innerText.slice(-1200)').catch(() => null) }));
  throw error;
} finally {
  await Promise.allSettled([customer.close(), seller.close(), logistics?.close()]);
}
