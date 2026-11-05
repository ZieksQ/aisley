// Isolated HTTP contracts for Homepage session/race checks; no real accounts or database.
import { createServer } from 'node:http';

const state = { viewer: null, homeDelay: 0, pageDelay: 0, authDelay: 0, homeFailure: false, pageFailure: false, requests: [] };
function product(owner, index) {
  return {
    id: `${owner}-${index}`, slug: `${owner}-${index}`, title: `${owner} product ${index}`,
    thumbnailUrl: null, price: 120, originalPrice: null, minPrice: null, maxPrice: null,
    discountPercent: null, averageRating: null, reviewCount: 0, soldCount: 0,
    stockStatus: 'in_stock', shop: { id: 'shop', slug: 'shop', name: 'Public Shop' }, badges: [],
  };
}
function homepage(owner) {
  const name = owner ?? 'Guest';
  return {
    viewer: { isAuthenticated: owner !== null, displayName: owner, email: owner ? `${owner}@example.test` : null, deliveryLocation: null, cartItemCount: 0 },
    campaigns: { hero: [], side: [] }, advertisementLayer: null, quickActions: [],
    categories: [
      ['pet-supplies', 'Pet Supplies'], ['electronics-and-gadgets', 'Electronics and Gadgets'],
      ['womens-apparel', "Women's Apparel"], ['mens-apparel', "Men's Apparel"],
      ['kids-and-baby', 'Kids and Baby'], ['health-and-beauty', 'Health and Beauty'],
      ['books-and-media', 'Books and Media'], ['food-and-gourmet', 'Food and Gourmet'],
      ['automotive-motorcycle-group-9', 'Automotive & Motorcycle - Group 9'],
      ['furniture-and-office-equipment', 'Furniture and Office Equipment'],
      ['jewelry-and-watches', 'Jewelry and Watches'], ['home-and-garden', 'Home and Garden'],
      ['sports-and-outdoors', 'Sports and Outdoors'],
      ['office-and-school-supplies-group-12', 'Office and School Supplies - Group 12'],
      ['unknown-group', 'New main group'],
    ].map(([slug, name]) => ({ id: slug, slug, name, imageUrl: null })),
    flashDeals: { id: 'deal', name: 'Fixture deal', endsAt: new Date(Date.now() + 3600000).toISOString(), products: [product('Deal', 0)] }, topProducts: [product('Top', 0)], recentlyViewed: owner ? [product(`${name} history`, 0)] : [],
    // Same initial IDs/cursor expose the old boolean-only restoration bug.
    recommendations: { items: [{ ...product(name, 0), id: 'shared-base' }], nextCursor: 'next-page', pageSize: 20 },
  };
}

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:18081');
  const json = (body, status = 200, extra = {}) => {
    response.writeHead(status, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': request.headers.origin ?? 'http://127.0.0.1:15174',
      'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': request.headers['access-control-request-headers'] ?? 'Content-Type, X-Requested-With', ...extra,
    });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'OPTIONS') return json({});
  if (url.pathname === '/__state') return json(state);
  if (url.pathname === '/__configure') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const config = JSON.parse(body);
    for (const key of ['viewer', 'homeDelay', 'pageDelay', 'authDelay', 'homeFailure', 'pageFailure']) {
      if (key in config) state[key] = config[key];
    }
    if (config.reset) state.requests = [];
    return json({ ok: true });
  }
  // Only credentialed browser reads personalize; Next's SSR read stays public.
  const owner = request.headers.cookie?.includes('homepage_test_session=1') ? state.viewer : null;
  state.requests.push({ path: url.pathname, owner, cursor: url.searchParams.get('cursor'), completed: false });
  const record = state.requests.at(-1);
  const delay = async (duration) => {
    if (duration) await new Promise((done) => setTimeout(done, duration));
    record.completed = true;
  };
  if (url.pathname === '/sanctum/csrf-cookie') return json({}, 200, { 'Set-Cookie': 'XSRF-TOKEN=fixture; Path=/; SameSite=Lax' });
  if (url.pathname === '/api/v1/customer/auth/me') {
    await delay(state.authDelay);
    return owner ? json({ customer: { id: `customer-${owner}`, displayName: owner, avatarUrl: null, role: 'customer', status: 'active' } }) : json({ message: 'Unauthenticated' }, 401);
  }
  if (url.pathname === '/api/v1/customer/auth/logout') {
    state.viewer = null;
    return json({ message: 'Signed out' });
  }
  if (url.pathname === '/api/v1/customer/home') {
    const fail = state.homeFailure;
    await delay(state.homeDelay);
    return fail ? json({ message: 'Fixture home unavailable' }, 503) : json(homepage(owner));
  }
  if (url.pathname === '/api/v1/customer/home/recommendations') {
    const fail = state.pageFailure;
    await delay(state.pageDelay);
    return fail ? json({ message: 'Fixture page unavailable' }, 503) : json({ recommendations: { items: [product(owner ?? 'Guest', 1)], nextCursor: null, pageSize: 20 } });
  }
  if (url.pathname === '/api/v1/customer/products/search') return json({ items: [product('Search', 0)], pagination: { currentPage: 1, lastPage: 1, perPage: 20, total: 1 } });
  if (url.pathname === '/api/v1/customer/cart') return json({ data: { id: 'cart', itemCount: 0, distinctItemCount: 0, subtotal: 0, availableSubtotal: 0, items: [] } });
  if (url.pathname === '/api/v1/customer/wishlist/status') return json({ data: Object.fromEntries(url.searchParams.getAll('product_ids[]').map((id) => [id, false])) });
  if (url.pathname.includes('/notifications')) return json({ data: [], unread_count: 0, meta: { unread_count: 0 } });
  return json({ data: [], counts: {}, meta: { next_cursor: null, unread_count: 0, total: 0 } });
}).listen(18081, '127.0.0.1', () => console.log('Homepage fixture ready on 18081'));
