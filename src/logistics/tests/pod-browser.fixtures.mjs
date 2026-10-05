// Browser-only fixtures for delayed photos, unavailable reads, and uncertain mutations.
export function installPodFixtures() {
  const original = window.fetch.bind(window)
  const at = '2026-10-05T01:00:00Z'
  const review = (id) => ({
    task_id: `task-${id}`, task_revision: 5, shipment_revision: 5, shipment_reference: `WAY-${id}`,
    order: { reference: `POD-${id}`, payment_method: 'cod', payment_status: 'pending' },
    destination: { recipient_name: 'Test recipient', address: 'Quezon City, Metro Manila' },
    proof: { id: `proof-${id}`, status: 'awaiting_validation', submitted_at: at },
    courier: { id: 'courier-1', name: 'Test Courier' },
    cod: { collected: true, declared_amount: '100.00', currency: 'PHP', declared_at: at },
    intent: { id: `intent-${id}`, approval_mode: 'manual', automatic_review_error: null },
    review: { method: null, reviewer: null, reviewed_at: null, reason: null },
  })
  const row = { id: 'cash-1', order_reference: 'POD-1', courier_id: 'courier-1', courier_name: 'Test Courier', currency: 'PHP', amount_cents: 10000, delivered_at: at }
  const receipt = { id: 'receipt-1', courier_name: 'Test Courier', currency: 'PHP', total_cents: 10000, received_at: at, simulation_credit: 'credited', orders: [{ reference: 'POD-1', amount_cents: 10000 }] }
  const page = (data) => ({ data, meta: { last_page: 1, total: data.length } })
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  window.podFixture = { mode: sessionStorage.getItem('pod-mode') ?? 'normal', writes: [], reviews: [review(1), review(2)], history: [], collected: false, navigation: crypto.randomUUID() }
  window.confirm = () => true
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin)
    const path = parsed.pathname
    const fixture = window.podFixture
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    if (path.endsWith('/auth/me')) return json({ logistics: { id: 'logistics', email: 'logistics@example.test', role: 'logistics', status: 'active', profile: { first_name: 'Logistics', last_name: 'Reviewer' }, organization: { id: 'org-1', business_name: 'Final Mile', hub: { id: 'hub-1', name: 'Main Hub' } } } })
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/csrf-cookie')) return new Response(null, { status: 204 })
    if (path.endsWith('/photo')) {
      if (fixture.mode === 'photo-error') return json({ message: 'Private photo unavailable.' }, 503)
      const first = path.includes('proof-1')
      if (first) await new Promise((resolve) => setTimeout(resolve, 1800))
      return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="${first ? 13 : 17}" height="20"><rect width="100%" height="100%" fill="${first ? 'red' : 'blue'}"/></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } })
    }
    const relevant = path.includes('delivery-confirmations') || path.includes('delivery-approval-settings') || path.includes('/finance/courier-cash') || path.endsWith('/finance/billing') || path.endsWith('/reject') || path.endsWith('/update-status/transitions')
    if (!relevant) return json({ data: [], unread_count: 0 })
    if (options.method && options.method !== 'GET') {
      const write = { path, body: JSON.parse(options.body ?? '{}'), key: new Headers(options.headers).get('Idempotency-Key') }
      fixture.writes.push(write)
      if (fixture.writes.length === 1) return json({ message: 'Result unavailable. Retry the same action.' }, 503)
      if (path.endsWith('/receipts')) { fixture.collected = true; return json({ data: receipt }, 201) }
      if (path.endsWith('/reject')) {
        const id = path.split('/').at(-2)
        const reviewed = fixture.reviews.find((item) => item.proof.id === id)
        reviewed.proof.status = 'rejected'
        reviewed.review = { method: 'manual', reviewer: 'Logistics Reviewer', reviewed_at: at, reason: write.body.reason }
        fixture.history.push(reviewed)
        fixture.reviews = fixture.reviews.filter((item) => item.proof.id !== id)
      }
      return json({ data: {} })
    }
    while (fixture.mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 50))
    if (fixture.mode === 'error') return json({ message: 'Service temporarily unavailable.' }, 503)
    if (path.endsWith('/delivery-confirmations')) return json(page(fixture.mode === 'empty' ? [] : parsed.searchParams.get('view') === 'history' ? fixture.history : fixture.reviews))
    if (path.endsWith('/delivery-approval-settings')) return json({ data: { mode: 'manual' } })
    if (path.endsWith('/finance/billing')) return json({ data: { label: 'Simulated payment account', masked_identifier: '••••1234', currency: 'PHP', active: true, simulation_enabled: true } })
    if (path.endsWith('/receipts')) return json(page(fixture.mode === 'empty' ? [] : [receipt]))
    const rows = fixture.mode === 'empty' || fixture.collected ? [] : [row]
    return json({ ...page(rows), balances: rows.length ? [{ courier_id: 'courier-1', courier_name: 'Test Courier', currency: 'PHP', outstanding_cents: 10000, order_count: 1 }] : [] })
  }
}
