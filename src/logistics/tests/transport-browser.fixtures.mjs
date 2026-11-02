export function installTransportFixtures() {
  const original = window.fetch.bind(window)
  const at = '2026-11-01T04:35:00Z'
  const connection = (id, from, to, accepted = true) => ({
    id,
    from_hub_id: from,
    to_hub_id: to,
    sender_requested: true,
    receiver_accepted: accepted,
    is_active: true,
    revision: 1,
    from_hub: { name: `${from} hub` },
    to_hub: { name: `${to} hub` }
  })
  const proof = (id, status = 'awaiting_validation') => ({
    task_id: `task-${id}`,
    task_revision: 4,
    shipment_revision: 6,
    shipment_reference: `WAY-${id}`,
    order: {
      reference: `ORD-${id}`,
      payment_method: 'cod',
      payment_status: 'pending'
    },
    destination: {
      recipient_name: 'Mariel Santos',
      address: 'San Pedro, Laguna'
    },
    proof: { id: `proof-${id}`, status, submitted_at: at },
    courier: { id: 'driver-1', name: 'Rafael Mendoza' },
    cod: { collected: true, declared_amount: '847.50', currency: 'PHP' },
    intent: {
      id: `intent-${id}`,
      approval_mode: 'manual',
      automatic_review_error: null
    },
    review: {
      method: status === 'validated' ? 'manual' : null,
      reviewer: 'Lea Cruz',
      reviewed_at: status === 'validated' ? at : null,
      reason: null
    }
  })
  const trip = (id, status, extra = {}) => ({
    id,
    status,
    direction: 'outbound',
    revision: 3,
    from_hub: { id: 'alpha', name: 'Calamba hub' },
    to_hub: { id: 'local', name: 'San Pedro hub' },
    truck: { id: 'truck-1', plate_number: 'NDR 4827' },
    driver: { id: 'driver-1', name: 'Rafael Mendoza' },
    scheduled_for: at,
    parcel_count: 2,
    capacity_snapshot: 60,
    parcels: [],
    can_decide: status === 'pending_acceptance',
    can_receive: status === 'in_transfer',
    can_release: status === 'scheduled',
    can_depart: status === 'scheduled',
    lane_blocked: false,
    empty_return: false,
    ...extra
  })
  const parcel = (id) => ({
    shipment_id: id,
    reference: `WAY-${id}`,
    parcel_reference: `TRK-${id}`,
    received_at: at,
    revision: 2
  })
  const ready = [parcel('1'), parcel('2')]
  const state = (window.transportFixture = {
    navigation: crypto.randomUUID(),
    mode: 'normal',
    writes: [],
    photos: [],
    failDecision: true,
    connections: [connection('out-1', 'local', 'alpha')],
    incoming: [
      connection('in-1', 'beta', 'local'),
      connection('in-2', 'gamma', 'local', false)
    ],
    reviews: [proof('1047'), proof('1052')],
    history: [proof('1031', 'validated')],
    trips: {
      enabled: true,
      trucks: [
        {
          id: 'truck-1',
          plate_number: 'NDR 4827',
          make: 'Isuzu',
          model: 'Forward',
          max_parcels: 1
        }
      ],
      drivers: [{ id: 'driver-1', name: 'Rafael Mendoza' }],
      ready_groups: [
        {
          next_hub_id: 'alpha',
          next_hub: 'Calamba hub',
          lane_groups: [
            {
              lane_id: 'lane-1',
              lane_code: 'L01',
              lane_name: 'Calamba',
              parcels: ready
            }
          ]
        }
      ],
      outbound: [trip('outbound', 'scheduled')],
      inbound: [
        trip('pending', 'pending_acceptance'),
        trip('arriving', 'in_transfer', { courier_arrived_at: at }),
        trip('receiving', 'receiving')
      ],
      visitors: [trip('visitor', 'received')]
    }
  })
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.origin)
    const path = url.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/'))
      return original(input, options)
    if (path.endsWith('/auth/me'))
      return json({
        logistics: {
          id: 'logistics',
          email: 'ops@example.test',
          role: 'logistics',
          status: 'active',
          profile: { first_name: 'Lea', last_name: 'Cruz' },
          organization: {
            id: 'org',
            business_name: 'Southbound Logistics',
            hub: { id: 'local', name: 'San Pedro hub' }
          }
        }
      })
    if (path.endsWith('/policy-consent/status'))
      return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/csrf-cookie'))
      return new Response(null, { status: 204 })
    if (path.includes('/delivery-proofs/') && path.endsWith('/photo')) {
      state.photos.push(path)
      if (state.mode === 'photo-error')
        return json({ message: 'Private photo unavailable.' }, 503)
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#dce5ec"/><rect x="190" y="100" width="220" height="190" fill="#b69976"/><path d="M300 100v190" stroke="#e9d1ac" stroke-width="20"/><text x="220" y="335" font-size="16" fill="#334155">Synthetic delivery proof</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }
    if (options.method && options.method !== 'GET') {
      const body = JSON.parse(options.body ?? '{}')
      state.writes.push({
        path,
        body,
        key: new Headers(options.headers).get('Idempotency-Key'),
        credentials: options.credentials
      })
      if (
        path.endsWith('/update-status/transitions') ||
        path.endsWith('/reject')
      ) {
        if (state.failDecision) {
          state.failDecision = false
          return json({ message: 'Decision result uncertain.' }, 503)
        }
        const row = state.reviews.find(
          (item) =>
            item.proof.id === (body.evidence_id ?? path.split('/').at(-2))
        )
        row.proof.status = path.endsWith('/reject') ? 'rejected' : 'validated'
        row.review.reason = body.reason ?? null
        state.history.push(row)
        state.reviews = state.reviews.filter((item) => item !== row)
      }
      if (path.endsWith('/connections')) {
        const row = state.connections.find(
          (item) => item.to_hub_id === body.to_hub_id
        )
        if (row) {
          row.is_active = body.is_active
          row.sender_requested = body.is_active
          row.receiver_accepted = false
          row.revision++
        } else
          state.connections.push(
            connection('new', 'local', body.to_hub_id, false)
          )
      }
      if (path.endsWith('/consent')) {
        const row = state.incoming.find(
          (item) => item.id === path.split('/').at(-2)
        )
        row.receiver_accepted = body.accept
        row.sender_requested = body.accept
        row.is_active = body.accept
      }
      return json({
        data: {
          ...state.trips.outbound[0],
          reference: 'DSP-4827',
          parcel_count: 1,
          to_hub: { name: 'Calamba hub' }
        }
      })
    }
    if (state.mode === 'error' && !path.includes('notifications'))
      return json({ message: 'Read unavailable. Try again.' }, 503)
    if (path.endsWith('/linehaul')) {
      const page = Number(url.searchParams.get('page') ?? 1)
      let hubs = [
        {
          id: page === 1 ? 'delta' : 'epsilon',
          name: page === 1 ? 'Binan hub' : 'Santa Rosa hub',
          business_name: page === 1 ? 'Laguna Parcel Co.' : 'Rosa Freight',
          city_municipality: 'Binan',
          province: 'Laguna'
        }
      ]
      if (url.searchParams.get('search'))
        hubs = hubs.filter((hub) =>
          hub.business_name
            .toLowerCase()
            .includes(url.searchParams.get('search').toLowerCase())
        )
      return json({
        data: {
          enabled: true,
          hubs: state.mode === 'empty' ? [] : hubs,
          hub_directory: { current_page: page, last_page: 2, total: 21 },
          connections: state.mode === 'empty' ? [] : state.connections,
          incoming_connections: state.mode === 'empty' ? [] : state.incoming
        }
      })
    }
    if (path.endsWith('/linehaul/trips'))
      return json({
        data:
          state.mode === 'empty'
            ? {
                ...state.trips,
                ready_groups: [],
                inbound: [],
                outbound: [],
                visitors: []
              }
            : state.trips
      })
    if (path.endsWith('/delivery-confirmations')) {
      let rows =
        url.searchParams.get('view') === 'history'
          ? state.history
          : state.reviews
      if (url.searchParams.get('search'))
        rows = rows.filter((row) =>
          row.order.reference.includes(url.searchParams.get('search'))
        )
      if (state.mode === 'empty') rows = []
      return json({
        data: rows,
        meta: { current_page: 1, last_page: 1, total: rows.length }
      })
    }
    if (path.endsWith('/delivery-approval-settings'))
      return json({ data: { mode: 'manual' } })
    if (path.endsWith('/dashboard/queue')) {
      const rows =
        url.searchParams.get('status') === 'delivery_assigned' ||
        state.mode === 'empty'
          ? []
          : ready.map((row) => ({
              shipment_id: row.shipment_id,
              revision: 2,
              tasks: [],
              parcel: {
                order_reference: `ORD-${row.shipment_id}`,
                reference: row.reference,
                tracking_id: row.parcel_reference
              },
              sorting_lane: null
            }))
      return json({
        data: rows,
        meta: { current_page: 1, last_page: 1, total: rows.length },
        summary: { by_lane: [] }
      })
    }
    if (path.endsWith('/dispatch/couriers'))
      return json({
        data: [
          {
            courier_id: 'driver-1',
            name: 'Rafael Mendoza',
            email: 'driver@example.test',
            contact_number: '09171234827',
            vehicle: { vehicle_type: 'motorcycle', plate_number: 'MC 4827' }
          }
        ]
      })
    if (path.endsWith('/dispatch/schedules'))
      return json({
        data: [
          {
            id: 'schedule-1',
            reference: 'DSP-4827',
            courier: {
              name: 'Rafael Mendoza',
              email: 'driver@example.test',
              contact_number: '09171234827'
            },
            scheduled_for: at,
            parcel_count: 2,
            parcels: [{ source_lane: { code: 'L01' } }]
          }
        ]
      })
    if (path.endsWith('/sorting')) return json({ data: { lanes: [] } })
    return json({
      data: [],
      unread_count: 0,
      meta: { unread_count: 0, next_cursor: null }
    })
  }
}
