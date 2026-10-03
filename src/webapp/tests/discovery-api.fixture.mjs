// Local HTTP fixture for SSR/browser checks. No Laravel, database, accounts or external services.
// Run from src/webapp: node tests/discovery-api.fixture.mjs
import { createServer } from 'node:http';

const state = { requests: [], failure: null, delay: 0 };
const category = { id: 'category', slug: 'clothing', name: 'Clothing', imageUrl: null };
const shop = { id: 'shop', slug: 'canvas', name: 'Canvas Shop', description: 'Plain <script> text', logoUrl: null, bannerUrl: null, category };
const home = {
  viewer: { isAuthenticated: false, displayName: null, email: null, deliveryLocation: null, cartItemCount: 0 },
  campaigns: { hero: [], side: [] }, advertisementLayer: null, quickActions: [], categories: [],
  flashDeals: null, topProducts: [], recentlyViewed: [], recommendations: { items: [], nextCursor: null, pageSize: 20 },
};
const product = (index) => ({
  id: `product-${index}`, slug: `shirt-${index}`, title: `Canvas Shirt ${index}`, thumbnailUrl: null,
  price: 120, originalPrice: null, minPrice: null, maxPrice: null, discountPercent: null,
  averageRating: null, reviewCount: 0, soldCount: 0, stockStatus: 'in_stock', shop, badges: [],
});

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:18080');
  const json = (body, status = 200, extra = {}) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': request.headers.origin ?? '*',
      'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*', ...extra });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'OPTIONS') return json({});
  if (url.pathname === '/__state') return json(state);
  if (url.pathname === '/__configure') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    if (input.reset) state.requests = [];
    if ('failure' in input) state.failure = input.failure;
    if ('delay' in input) state.delay = input.delay;
    return json({ ok: true });
  }
  state.requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), cookie: request.headers.cookie ?? null, authorization: request.headers.authorization ?? null });
  if (url.pathname.endsWith('/auth/me')) return json({ message: 'Unauthenticated' }, 401);
  if (url.pathname === '/api/v1/customer/home') return json(home);
  if (url.pathname === '/api/v1/customer/shops/canvas') return json({ data: { ...shop, productCount: 21, isVerified: true, rating: null, reviewCount: 0, location: null, joinedAt: '2026-01-01' } });
  if (url.pathname === '/api/v1/customer/shops/missing' || url.pathname.includes('/missing/products')) return json({}, 404);
  const search = ['/api/v1/customer/search/shops', '/api/v1/customer/products/search', '/api/v1/customer/shops/canvas/products', '/api/v1/customer/shops'].includes(url.pathname);
  if (!search) return json({});
  const query = url.searchParams.get('q') ?? '';
  if (state.delay) await new Promise((done) => setTimeout(done, state.delay));
  if (state.failure) return json({ message: 'Fixture filter is invalid.', errors: state.failure === 422 ? { q: ['Fixture filter is invalid.'] } : {} }, state.failure, { 'Retry-After': '2' });
  const page = Number(url.searchParams.get('page') ?? 1);
  const total = query === 'absent' ? 0 : 21;
  const shops = url.pathname.endsWith('/search/shops') || url.pathname === '/api/v1/customer/shops';
  const items = !total || page > 2 ? [] : Array.from({ length: page === 1 ? 20 : 1 }, (_, index) => shops
    ? { ...shop, id: `shop-${page}-${index}`, slug: 'canvas', name: `Canvas Shop ${page}-${index}` }
    : product((page - 1) * 20 + index));
  const pagination = { currentPage: page, lastPage: total ? 2 : 1, perPage: 20, total };
  if (url.pathname.includes('/shops/canvas/products')) return json({ shop, categories: [category, { id: 'accessories', slug: 'accessories', name: 'Accessories' }], items, pagination });
  if (url.pathname === '/api/v1/customer/shops') return json({ items, categories: [category], pagination });
  return json({ query, items, pagination });
}).listen(18080, '127.0.0.1', () => console.log('Discovery fixture ready on 18080'));
