// Synthetic API for the real notification routes; installed before app scripts run.
export function installNotificationsFixture(role) {
  const original = window.fetch.bind(window);
  const ticketId = 'b7e14ff6-3f11-4d9d-b17e-dc68359d1901';
  const categories = {
    customer: ['orders', 'support', 'promotions'], seller: ['orders', 'support', 'inventory'],
    admin: ['registrations', 'support', 'finance'], logistics: ['pickups', 'support', 'couriers'],
  }[role].map(key => ({ key, label: key === 'support' ? 'Support tickets' : key[0].toUpperCase() + key.slice(1) }));
  const rows = Array.from({ length: 65 }, (_, index) => ({
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    type: index === 0 ? 'support-ticket.admin-replied' : 'notification.fixture',
    title: index === 0 ? 'New reply on your support ticket' : `Order update ${index + 1}`,
    summary: index === 0 ? 'Ticket TKT-1042 has an update. Open the ticket to review it.' : 'Your parcel has a new update. <script>Plain text stays safe.</script>',
    category: categories[index % categories.length].key, category_label: categories[index % categories.length].label,
    created_at: index === 4 ? null : '2026-11-04T02:15:00Z', read_at: index % 3 ? '2026-11-04T02:16:00Z' : null,
    resource_type: index === 0 ? 'support_ticket' : null, resource_id: index === 0 ? ticketId : null,
    destination: index === 0 ? (role === 'customer' ? '/account/support-tickets' : '/support-tickets') + `?ticket=${ticketId}` : '/notifications',
    order_id: null, order_reference: null, status: null, schedule: null,
  }));
  rows[4].title = 'Order ' + 'reference'.repeat(14);
  rows[4].category = 'future-category'; rows[4].category_label = null;
  rows[0].category = 'support'; rows[0].category_label = 'Support tickets';
  const state = window.notificationFixture = { rows, reads: [], queries: [], fail: false, failRead: false, delay: 0, empty: false, account: 'one', releases: [] };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
    const path = url.pathname;
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(input, options);
    const method = options.method ?? 'GET';
    if (path.endsWith('/auth/me')) return json({ [role]: {
      id: state.account, role, status: 'active', displayName: 'Notification reviewer', avatarUrl: null,
      email: 'fixture@example.test', profile: { first_name: 'Notification', last_name: 'Reviewer', profile_photo_url: null },
      permissions: ['notifications.view', 'dashboard.view', 'support-tickets.view'],
      shop: { id: 'shop-one', name: 'Maya Shop', status: 'active' },
      organization: { id: 'org-one', business_name: 'North Hub Logistics', hub: { id: 'hub-one', name: 'North Hub' } },
    } });
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: true } });
    if (path.includes('/notifications')) {
      if (path.endsWith('/unread-count')) return json(role === 'admin' ? { unread_count: rows.filter(row => !row.read_at).length } : { data: { unread_count: rows.filter(row => !row.read_at).length } });
      if (method === 'POST') {
        state.reads.push(path);
        if (state.failRead) return json({ message: 'Read update failed. Try again.' }, 503);
        if (path.endsWith('/read-all')) { rows.forEach(row => row.read_at = '2026-11-04T04:00:00Z'); return json({ updated_count: rows.length }); }
        const row = rows.find(item => path.includes(item.id));
        if (row) row.read_at = '2026-11-04T04:00:00Z';
        return json({ data: row });
      }
      const status = url.searchParams.get('status') ?? 'all';
      const category = url.searchParams.get('category') ?? 'all';
      const page = Number(url.searchParams.get('page') ?? 1);
      const perPage = Number(url.searchParams.get('per_page') ?? 20);
      state.queries.push({ status, category, page, perPage });
      // Capture the result before delaying to exercise out-of-order responses.
      const filtered = state.empty ? [] : rows.filter(row => (status === 'all' || (status === 'read' ? !!row.read_at : !row.read_at)) && (category === 'all' || row.category === category));
      const body = { data: structuredClone(filtered.slice((page - 1) * perPage, page * perPage)), meta: { total: filtered.length, current_page: page, last_page: Math.max(1, Math.ceil(filtered.length / perPage)), categories } };
      if (state.delay) await new Promise(done => setTimeout(done, state.delay));
      if (state.fail) return json({ message: 'Notifications temporarily unavailable.' }, 503);
      return json(body);
    }
    return json({ data: [], items: [], unread_count: 0, next_cursor: null, meta: { total: 0, unread_count: 0, next_cursor: null }, cart: { items: [], itemCount: 0 } });
  };
}
