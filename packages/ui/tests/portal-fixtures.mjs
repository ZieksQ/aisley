// Synthetic HTTP contracts for the actual three dashboard apps. No database or accounts.
export function installPortalFixtures() {
  const original = window.fetch.bind(window)
  const role = location.port.endsWith('75') ? 'admin' : location.port.endsWith('74') ? 'seller' : 'logistics'
  const permissions = localStorage.getItem('portal-restricted') ? [] : ['registrations.view', 'users.view', 'support-tickets.view', 'seller_compliance.manage', 'finance.view', 'notifications.view', 'audit-logs.view', 'platform-settings.view', 'notification-campaigns.view', 'vouchers.view']
  const generated_at = '2026-10-14T07:24:00Z'
  const state = window.portalFixture = { empty: false, failed: false, writes: [] }
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  const person = { id: `${role}-fixture`, role, status: 'active', email: `${role}@example.com`, profile: { first_name: 'Andrea', last_name: 'Reyes', profile_photo_url: null }, permissions, organization: { id: 'org-fixture', business_name: 'North Metro Logistics', hub: { id: 'hub-fixture', name: 'Quezon City hub' } } }
  const unavailable = { state: 'unavailable', reason: 'DOMAIN_NOT_IMPLEMENTED' }
  window.fetch = async (url, options = {}) => {
    const path = new URL(url, location.origin).pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    if (options.method && options.method !== 'GET') state.writes.push(path)
    if (path.endsWith('/auth/me')) return json({ [role]: person })
    if (path.endsWith('/auth/logout')) return json({})
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/dashboard') || path.endsWith('/dashboard/queue')) {
      await new Promise((done) => setTimeout(done, 250))
      if (state.failed === 'offline') throw new TypeError('Dashboard connection failed.')
      if (state.failed) return json({ message: 'Dashboard connection failed.' }, 503)
    }
    const n = (value) => state.empty ? 0 : value
    if (path === '/api/v1/admin/dashboard') return json({ data: {
      registrations: permissions.includes('registrations.view') ? { pending: { total: n(16), by_role: { customer: n(7), seller: n(6), logistics: n(3) } }, action_items: state.empty ? [] : [{ id: 'pending-one', role: 'seller', submitted_at: generated_at }, { id: 'pending-two', role: 'logistics', submitted_at: generated_at }] } : null,
      support_tickets: permissions.includes('support-tickets.view') ? { state: 'ready', count: n(12), filter: { status: 'open' }, destination: '/support-tickets?status=open' } : null,
      seller_compliance: permissions.includes('seller_compliance.manage') ? { state: 'ready', count: n(4), filter: { status: 'open' }, destination: '/seller-compliance?status=open' } : null,
      generated_at,
    } })
    if (path === '/api/v1/seller/dashboard') return json({ version: 1, code: null,
      shop: { id: 'shop-fixture', name: 'Andrea’s home essentials', status: 'active', is_on_vacation: false },
      period: { from: null, to: null, timezone: 'Asia/Manila', from_utc: null, to_utc_exclusive: null },
      sections: { catalog: { state: state.empty ? 'empty' : 'available', metrics: { total: n(48), active: n(37), draft: n(8), archived: n(3), zero_stock_products: n(2), zero_stock_skus: n(5) }, stock_signal: 'catalog_quantity' }, reviews: { state: state.empty ? 'empty' : 'available', metrics: { total: n(28), answered: n(24), unanswered: n(4) }, cohort: 'published_at' }, financial: unavailable, traffic: unavailable, orders: unavailable, inventory: unavailable, notifications: unavailable },
      actions: [], generated_at,
    })
    if (path === '/api/v1/seller/orders') return json({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } })
    if (path === '/api/v1/logistics/dashboard') return json({ hub: { id: 'hub-fixture', name: 'Quezon City hub', address: { barangay: 'Bagumbayan', city_municipality: 'Quezon City', province: 'Metro Manila', region: 'NCR' } }, summary: null, orders: [], freshness: { state: 'scaffold', generated_at } })
    if (path === '/api/v1/logistics/dashboard/queue') return json({ data: state.empty ? [] : Array.from({ length: 25 }, (_, i) => ({ id: `shipment-fixture-${i}` })), summary: { total: n(43), by_status: { ready_for_pickup: n(14), in_transit: n(18), out_for_delivery: n(11) }, pending_evidence: n(5), pending_completion: n(3) }, meta: { total: n(43), current_page: 1, last_page: state.empty ? 1 : 2, per_page: 25 }, freshness: { state: 'authoritative', generated_at } })
    if (path.endsWith('/chat-notifications')) return json({ data: [], meta: { unread_count: 0 } })
    if (path.endsWith('/unread-count')) return json(role === 'admin' ? { unread_count: 0 } : { data: { unread_count: 0 } })
    return json({ data: [], items: [], next_cursor: null, meta: { total: 0, current_page: 1, last_page: 1 }, summary: {} })
  }
}
