// Synthetic aggregate-only API for the actual Admin routes. Never sends messages.
export function installCampaignsFixture() {
  const original = window.fetch.bind(window);
  const audience = 'Customers opted in to in-app promotions';
  const states = ['draft', 'sending', 'completed', 'partially_failed', 'failed', 'preparing', 'queued'];
  const names = ['Weekend finds for your home', 'Fresh arrivals from local shops', 'Your next everyday essentials', 'Discover the November collection', 'A little inspiration for your space'];
  const rows = Array.from({ length: 23 }, (_, i) => ({
    id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    title: names[i % names.length], body: 'Explore thoughtful finds from local shops. Open the collection to find something for your everyday.',
    audience_key: 'opted_in_customers', audience_label: audience, status: states[i % states.length], revision: 1,
    destination_type: null, destination_id: null, preview: null,
    snapshot_count: ['draft', 'preparing'].includes(states[i % 7]) ? 0 : 120,
    delivered_count: ['sending', 'completed', 'partially_failed'].includes(states[i % 7]) ? 108 : 0,
    skipped_count: states[i % 7] === 'completed' ? 12 : ['sending', 'partially_failed'].includes(states[i % 7]) ? 8 : 0,
    failed_count: states[i % 7] === 'failed' ? 120 : states[i % 7] === 'partially_failed' ? 4 : 0,
    created_at: '2026-11-05T02:15:00Z', confirmed_at: i % 7 === 0 ? null : '2026-11-05T03:00:00Z',
    completed_at: ['completed', 'partially_failed', 'failed'].includes(states[i % 7]) ? '2026-11-05T03:02:00Z' : null,
  }));
  const state = window.campaignFixture = { rows, account: 'campaign-reviewer', manage: true, view: true, failList: false, failDetail: false, failSave: false, failPreview: false, stale: false, timeout: false, commitTimeout: false, delay: 0, eligible: 120, calls: [] };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
    const path = url.pathname;
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(input, options);
    if (path.endsWith('/auth/me')) return json({ admin: {
      id: state.account, role: 'admin', status: 'active', email: 'reviewer@example.test',
      profile: { first_name: 'Campaign', last_name: 'Reviewer' },
      permissions: [...(state.view ? ['notification-campaigns.view'] : []), ...(state.manage ? ['notification-campaigns.manage'] : [])],
    } });
    if (path.includes('policy-consent/status')) return json({ data: { all_required_accepted: true } });
    if (!path.includes('/notification-campaigns')) return json({ data: [] });
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    state.calls.push({ path, method, body, key: new Headers(options.headers).get('Idempotency-Key') });
    const suffix = path.split('/notification-campaigns')[1];
    const row = rows.find(item => suffix.includes(item.id));
    if (method === 'GET' && !suffix) {
      const page = Number(url.searchParams.get('page') ?? 1);
      const data = structuredClone(rows.slice((page - 1) * 20, page * 20));
      if (state.delay) await new Promise(done => setTimeout(done, state.delay));
      return state.failList ? json({ message: 'History unavailable.' }, 503) : json({ data, meta: { current_page: page, last_page: Math.max(1, Math.ceil(rows.length / 20)), total: rows.length } });
    }
    if (method === 'GET') return state.failDetail ? json({ message: 'Status unavailable.' }, 503) : row ? json({ data: structuredClone(row) }) : json({ message: 'Campaign not found.' }, 404);
    if (state.delay) await new Promise(done => setTimeout(done, state.delay));
    if (state.failSave && (method === 'PATCH' || !suffix)) return json({ message: 'Check your message.', errors: { title: ['Choose a different title.'], destination_id: ['The destination is unavailable.'] } }, 422);
    if (method === 'POST' && !suffix) {
      const draft = { ...structuredClone(rows[0]), ...body, id: crypto.randomUUID(), status: 'draft', revision: 1 };
      rows.unshift(draft);
      return json({ data: draft }, 201);
    }
    if (state.stale) { row.revision++; return json({ message: 'This draft has a newer revision.' }, 409); }
    if (method === 'PATCH') { Object.assign(row, body, { revision: row.revision + 1 }); return json({ data: row }); }
    if (suffix.endsWith('/preview')) return state.failPreview ? json({ message: 'Audience unavailable.' }, 503) : json({ data: { audience_label: audience, eligible_count: state.eligible, revision: row.revision, calculated_at: '2026-11-05T04:00:00Z', dispatch_allowed: state.eligible > 0 && state.eligible <= 10000 } });
    if (suffix.endsWith('/send')) {
      if (state.commitTimeout || !state.timeout) Object.assign(row, { status: 'queued', snapshot_count: 120 });
      if (state.timeout || state.commitTimeout) throw new TypeError('Network connection lost.');
      return json({ data: row });
    }
    return json({ data: row });
  };
}
