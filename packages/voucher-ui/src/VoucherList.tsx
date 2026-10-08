import { useEffect, useState } from 'react'
import { Button, TextField, SelectField } from '@aisley/ui'
import { benefit, date, denied, statuses, titleCase } from './model'
import { Pagination } from './Pagination'
import type { Failure, Page, Voucher, VoucherProps } from './types'

export function VoucherList(props: VoucherProps) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Page<Voucher> | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const filters = new URLSearchParams({ page: String(page) })
    if (query) filters.set('search', query)
    if (status) filters.set('status', status)
    if (kind) filters.set('benefit', kind)
    void props
      .request<Page<Voucher>>(`${props.prefix}?${filters}`, {
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data)
      })
      .catch((cause: Failure) => {
        if (!controller.signal.aborted) {
          setError(cause)
          setResult(null)
          if (denied(cause)) {
            setSearch('')
            setQuery('')
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [props.request, props.prefix, page, query, status, kind, reload])
  return (
    <main className="vouchers">
      <header>
        <h1>Vouchers</h1>
        {props.canManage && !denied(error ?? new Error()) && (
          <Button onClick={() => props.navigate('/vouchers/new')}>
            Create voucher
          </Button>
        )}
      </header>
      <form
        className="voucher-fields mb-6"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(search)
          setPage(1)
        }}
      >
        <TextField
          id="voucher-search"
          label="Search name or code"
          maxLength={64}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          id="voucher-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {titleCase(value)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="voucher-benefit"
          label="Benefit"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value)
            setPage(1)
          }}
        >
          <option value="">All benefits</option>
          <option value="discount">Merchandise discount</option>
          <option value="shipping">Shipping saving</option>
        </SelectField>
        <div className="voucher-actions">
          <Button variant="outline" type="submit">
            Search
          </Button>
        </div>
      </form>
      {loading ? (
        <p role="status">Loading vouchers…</p>
      ) : error ? (
        <div className="voucher-error" role="alert">
          <p>{error.message}</p>
          {!denied(error) && (
            <Button
              variant="outline"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry loading
            </Button>
          )}
        </div>
      ) : (
        result && (
          <>
            {result.data.length === 0 ? (
              <p>No vouchers match these filters.</p>
            ) : (
              <div
                className="voucher-table"
                tabIndex={0}
                role="region"
                aria-label="Voucher list"
              >
                <table>
                  <caption>
                    Voucher definitions · Schedules in Asia/Manila
                  </caption>
                  <thead>
                    <tr>
                      {[
                        'Voucher',
                        'Benefit',
                        'Status',
                        'Validity',
                        'Usage',
                      ].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((voucher) => (
                      <tr key={voucher.id}>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              props.navigate(`/vouchers/${voucher.id}`)
                            }
                          >
                            {voucher.name ?? voucher.code}
                          </Button>
                          <span className="voucher-code">{voucher.code}</span>
                        </td>
                        <td>{benefit(voucher.terms)}</td>
                        <td>
                          {titleCase(voucher.status)}
                          {voucher.draft && voucher.lifecycle === 'published'
                            ? ' · Pending draft'
                            : ''}
                        </td>
                        <td>
                          {date(voucher.terms.starts_at)} –{' '}
                          {date(voucher.terms.ends_at)}
                        </td>
                        <td>
                          {voucher.redeemed_count} /{' '}
                          {voucher.terms.global_limit ?? 'Unlimited'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination meta={result.meta} onPage={setPage} />
          </>
        )
      )}
    </main>
  )
}
