import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readSupportTicketFilters, supportTicketFilterSearch } from '../src/lib/supportTicketFilters.ts'

test('dashboard link initializes exactly the open all-assignee queue', () => {
  assert.deepEqual(readSupportTicketFilters(new URLSearchParams('status=open')), { status: 'open', category: undefined, assignee: 'all' })
})
test('invalid URL filters and cursors are ignored', () => {
  assert.deepEqual(readSupportTicketFilters(new URLSearchParams('status=unknown&category=unknown&assignee=unknown&cursor=stale')), {
    status: undefined, category: undefined, assignee: 'all',
  })
})
test('allow-listed filters serialize and round-trip without stale pagination', () => {
  const filters = { status: 'waiting_for_requester', category: 'delivery', assignee: 'mine', cursor: 'stale' }
  const search = supportTicketFilterSearch(filters)
  assert.equal(search.toString(), 'status=waiting_for_requester&category=delivery&assignee=mine')
  assert.deepEqual(readSupportTicketFilters(search), { status: filters.status, category: filters.category, assignee: filters.assignee })
  assert.equal(supportTicketFilterSearch({ assignee: 'all' }).toString(), '')
})
