import { useEffect, useState } from 'react'
import { Button } from '@aisley/ui'
import { date, denied, money, titleCase } from './model'
import { TermsView } from './TermsView'
import { Pagination } from './Pagination'
import type { Failure, Page, Terms, VoucherProps } from './types'

type Row = {
  id: string
  number?: number
  state?: string
  action?: string
  revision?: number
  created_at?: string
  published_at?: string | null
  terms?: Terms
  order_reference?: string
  order_status?: string
  redeemed_at?: string
  version?: number
  discount_amount?: string
  currency?: string
}
export function VoucherHistory({
  id,
  revision,
  onDenied,
  ...props
}: VoucherProps & { id: string; revision: number; onDenied: () => void }) {
  const [kind, setKind] = useState('versions')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<
    (Page<Row> & { kind: string; page: number; revision: number }) | null
  >(null)
  const [error, setError] = useState<Failure | null>(null)
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<Row | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setSelected(null)
    setError(null)
    void props
      .request<Page<Row>>(`${props.prefix}/${id}/${kind}?page=${page}`, {
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ ...data, kind, page, revision })
      })
      .catch((cause: Failure) => {
        if (!controller.signal.aborted) {
          if (denied(cause)) onDenied()
          else setError(cause)
        }
      })
    return () => controller.abort()
  }, [props.request, props.prefix, id, revision, kind, page, reload, onDenied])
  const visibleResult =
    result?.kind === kind &&
    result.page === page &&
    result.revision === revision
      ? result
      : null
  return (
    <section aria-label="Voucher history">
      <h2>History</h2>
      <div className="voucher-actions">
        {['versions', 'actions', 'redemptions'].map((value) => (
          <Button
            variant="outline"
            key={value}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value)
              setPage(1)
            }}
          >
            {titleCase(value)}
          </Button>
        ))}
      </div>
      {error ? (
        <div role="alert" className="voucher-error">
          <p>{error.message}</p>
          <Button
            variant="outline"
            onClick={() => setReload((value) => value + 1)}
          >
            Retry history
          </Button>
        </div>
      ) : !visibleResult ? (
        <p role="status">Loading history…</p>
      ) : (
        <>
          {!visibleResult.data.length ? (
            <p>No {kind} yet.</p>
          ) : (
            <div
              className="voucher-table"
              tabIndex={0}
              role="region"
              aria-label={`${titleCase(kind)} history`}
            >
              <table>
                <caption>
                  {titleCase(kind)}
                  {kind === 'redemptions'
                    ? ' · Cancelled Orders remain consumed'
                    : ''}
                </caption>
                <thead>
                  <tr>
                    {(kind === 'versions'
                      ? ['Version', 'State', 'Published', 'Terms']
                      : kind === 'actions'
                        ? ['Action', 'Revision', 'Date']
                        : [
                            'Order',
                            'Order status',
                            'Redeemed',
                            'Version',
                            'Customer saving',
                          ]
                    ).map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleResult.data.map((row) => (
                    <tr key={row.id}>
                      {kind === 'versions' ? (
                        <>
                          <td>{row.number}</td>
                          <td>{titleCase(row.state ?? '')}</td>
                          <td>
                            {row.published_at ? date(row.published_at) : '—'}
                          </td>
                          <td>
                            <Button
                              variant="outline"
                              onClick={() => setSelected(row)}
                            >
                              View version {row.number}
                            </Button>
                          </td>
                        </>
                      ) : kind === 'actions' ? (
                        <>
                          <td>
                            {titleCase((row.action ?? '').replaceAll('_', ' '))}
                          </td>
                          <td>{row.revision}</td>
                          <td>{date(row.created_at!)}</td>
                        </>
                      ) : (
                        <>
                          <td>{row.order_reference}</td>
                          <td>{titleCase(row.order_status ?? '')}</td>
                          <td>{date(row.redeemed_at!)}</td>
                          <td>{row.version ?? 'Legacy'}</td>
                          <td className="amount">
                            {money(row.discount_amount!)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination meta={visibleResult.meta} onPage={setPage} />
        </>
      )}
      {selected?.terms && (
        <section className="mt-6">
          <h3 className="mb-4">Version {selected.number} terms</h3>
          <TermsView terms={selected.terms} />
        </section>
      )}
    </section>
  )
}
