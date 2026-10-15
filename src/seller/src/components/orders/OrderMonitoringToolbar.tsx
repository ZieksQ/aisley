import { useEffect, useState, type FormEvent } from 'react'
import { FaMagnifyingGlass } from 'react-icons/fa6'
import { orderStatuses } from '../../types/orders'
import { OrderButton } from './OrderUi'
import { OrderSortDialog, type OrderSortOption } from './OrderSortDialog'

const sortOptions: OrderSortOption[] = [
  { value: 'activity_desc', label: 'Recent activity', description: 'Most recently updated orders first.' },
  { value: 'oldest', label: 'Oldest placed', description: 'Orders waiting the longest first.' },
  { value: 'amount_high', label: 'Highest total', description: 'Largest order totals first.' },
  { value: 'amount_low', label: 'Lowest total', description: 'Smallest order totals first.' },
  { value: 'status', label: 'Status', description: 'Group orders by their current status.' },
]

export function OrderMonitoringToolbar({ search, status, sort, onChange }: {
  search: string
  status: string
  sort: string
  onChange: (key: string, value: string) => void
}) {
  const [draft, setDraft] = useState(search)
  useEffect(() => setDraft(search), [search])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onChange('search', draft.trim())
  }

  return (
    <div className="order-monitoring-toolbar">
      <form className="order-search" onSubmit={submit} role="search" aria-label="Search Shop orders">
        <div>
          <label className="order-filter-label" htmlFor="order-search">Search orders</label>
          <input className="portal-input" id="order-search" type="search"
            placeholder="Order reference, product or SKU" maxLength={120} value={draft}
            onChange={(event) => setDraft(event.target.value)} />
        </div>
        <OrderButton type="submit"><FaMagnifyingGlass aria-hidden="true" />Search</OrderButton>
        {search && (
          <OrderButton variant="ghost" onClick={() => { setDraft(''); onChange('search', '') }}>
            Clear search
          </OrderButton>
        )}
      </form>
      <div className="order-filter-status">
        <label className="order-filter-label" htmlFor="order-status">Status</label>
        <select className="portal-input" id="order-status" value={status}
          onChange={(event) => onChange('status', event.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(orderStatuses).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </div>
      <OrderSortDialog value={sort} options={sortOptions} onChange={(value) => onChange('sort', value)} />
    </div>
  )
}
