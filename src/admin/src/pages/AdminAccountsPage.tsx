import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PortalButton, PortalField } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { fetchAdminAccounts } from '../lib/adminAccounts'
import type { ManagedAdmin } from '../types/adminAccounts'

export function AdminAccountsPage() {
  const { admin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [accounts, setAccounts] = useState<ManagedAdmin[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const query = params.toString()
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setAccounts([])
    fetchAdminAccounts(query, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setAccounts(response.data)
          setMeta(response.meta)
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : 'Unable to load Admin accounts.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [query, retry, admin?.id])
  useEffect(() => {
    setSearch(params.get('search') ?? '')
  }, [params])
  const page = (value: number) => {
    const next = new URLSearchParams(params)
    next.set('page', String(value))
    setParams(next)
  }
  return (
    <div className="portal-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Admin accounts</h2>
        <div className="flex flex-wrap gap-3">
          <Link className="portal-button" to="/admin-roles">
            Custom roles
          </Link>
          {admin?.permissions.includes('admin-accounts.create') && (
            <Link className="portal-button portal-button-primary" to="/admin-accounts/new">
              Create Admin
            </Link>
          )}
        </div>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const next = new URLSearchParams(params)
          next.set('search', search)
          next.delete('page')
          setParams(next)
        }}
      >
        <PortalField
          label="Search name or email"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="portal-field">
          <label htmlFor="admin-status-filter">Account status</label>
          <select
            className="portal-input"
            id="admin-status-filter"
            value={params.get('status') ?? 'active'}
            onChange={(event) => {
              const next = new URLSearchParams(params)
              next.set('status', event.target.value)
              next.delete('page')
              setParams(next)
            }}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
            <option value="all">All accounts</option>
          </select>
        </div>
        <PortalButton className="self-end" type="submit">
          Search
        </PortalButton>
      </form>
      {loading ? (
        <p role="status">Loading Admin accounts…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <PortalButton onClick={() => setRetry((value) => value + 1)}>Try again</PortalButton>
        </div>
      ) : (
        <>
          <div
            className="portal-panel overflow-x-auto"
            role="region"
            aria-label="Admin accounts table"
            tabIndex={0}
          >
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Admin', 'Access', 'Status', 'Setup', 'Action'].map((name) => (
                    <th className="p-4 font-semibold" scope="col" key={name}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    className="border-b border-slate-200 last:border-0 dark:border-slate-700"
                    key={account.id}
                  >
                    <td className="p-4">
                      <span className="block font-medium">
                        {account.profile?.first_name} {account.profile?.last_name}
                      </span>
                      <span className="break-all">{account.email}</span>
                    </td>
                    <td className="p-4">
                      {account.is_super_admin
                        ? 'Super admin'
                        : account.roles.map((role) => role.name).join(', ') ||
                          'Individual permissions'}
                    </td>
                    <td className="p-4">
                      {account.archived_at
                        ? 'Archived'
                        : account.status === 'active'
                        ? 'Active'
                        : 'Suspended'}
                    </td>
                    <td className="p-4">
                      {account.setup_required ? 'Pending verification' : 'Complete'}
                    </td>
                    <td className="p-4">
                      <Link
                        className="portal-button"
                        to={`/admin-accounts/${account.id}`}
                        aria-label={`View ${account.email}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!accounts.length && <p className="p-5">No Admin accounts match these filters.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {meta.total} accounts · Page {meta.current_page} of {meta.last_page}
            </p>
            <div className="flex gap-3">
              <PortalButton
                disabled={meta.current_page <= 1}
                onClick={() => page(meta.current_page - 1)}
              >
                Previous
              </PortalButton>
              <PortalButton
                disabled={meta.current_page >= meta.last_page}
                onClick={() => page(meta.current_page + 1)}
              >
                Next
              </PortalButton>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
