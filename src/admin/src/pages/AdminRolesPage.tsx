import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmationDialog, PortalButton, PortalField } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { AdminRoleForm } from '../components/admin-accounts/AdminRoleForm'
import { deleteAdminRole, fetchAdminRoles, fetchPermissions } from '../lib/adminAccounts'
import type { AdminRole, PermissionDefinition } from '../types/adminAccounts'

export function AdminRolesPage() {
  const { admin, refreshAdmin } = useAuth()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([])
  const [editing, setEditing] = useState<AdminRole | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminRole | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([fetchAdminRoles(controller.signal), fetchPermissions(controller.signal)])
      .then(([data, permissions]) => {
        if (!controller.signal.aborted) {
          setRoles(data.data)
          setCatalog(permissions.data)
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : 'Unable to load roles.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [retry, admin?.id])
  const refresh = useCallback(async () => {
    try {
      setRoles((await fetchAdminRoles()).data)
      await refreshAdmin()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The change was saved, but roles could not be refreshed. Try again.',
      )
    }
  }, [refreshAdmin])
  useEffect(() => {
    if (
      editing &&
      (!admin?.permissions.includes(
        editing === 'new' ? 'admin-accounts.create' : 'admin-accounts.update',
      ) ||
        (editing !== 'new' &&
          editing.permissions.some((slug) => !admin.permissions.includes(slug))))
    ) {
      setEditing(null)
    }
  }, [editing, admin?.permissions])
  if (!admin) return null
  async function remove() {
    if (!deleting || busy) return
    setBusy(true)
    setActionError('')
    try {
      await deleteAdminRole(deleting, password)
      setDeleting(null)
      setPassword('')
      setNotice('Role deleted.')
      await refresh()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Unable to delete this role.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="portal-page space-y-5">
      <Link className="portal-button" to="/admin-accounts">
        Back to Admin accounts
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Custom roles</h2>
        {!editing && admin.permissions.includes('admin-accounts.create') && (
          <PortalButton variant="primary" onClick={() => setEditing('new')}>
            Create role
          </PortalButton>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Loading custom roles…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <PortalButton onClick={() => setRetry((value) => value + 1)}>Try again</PortalButton>
        </div>
      ) : (
        <>
          {editing && (
            <AdminRoleForm
              key={editing === 'new' ? 'new' : `${editing.id}:${editing.revision}`}
              role={editing === 'new' ? undefined : editing}
              catalog={catalog}
              grantable={admin.permissions}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null)
                setNotice('Role saved. Assigned Admin accounts now use its current permissions.')
                await refresh()
              }}
            />
          )}
          <div
            className="portal-panel overflow-x-auto"
            role="region"
            aria-label="Custom roles table"
            tabIndex={0}
          >
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Role', 'Permissions', 'Assigned admins', 'Actions'].map((label) => (
                    <th className="p-4 font-semibold" scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const grantable = role.permissions.every((slug) =>
                    admin.permissions.includes(slug),
                  )
                  return (
                    <tr
                      className="border-b border-slate-200 last:border-0 dark:border-slate-700"
                      key={role.id}
                    >
                      <td className="p-4 font-medium">{role.name}</td>
                      <td className="p-4"><details><summary className="min-h-11 cursor-pointer py-3">{role.permissions.length} permissions</summary><ul className="space-y-1 pb-3">{role.permissions.map((slug) => <li key={slug}>{catalog.find((permission) => permission.slug === slug)?.name ?? slug}</li>)}</ul></details></td>
                      <td className="p-4">{role.member_count}</td>
                      <td className="p-4">
                        <div className="flex gap-3">
                          {admin.permissions.includes('admin-accounts.update') && (
                            <PortalButton
                              disabled={Boolean(editing) || !grantable}
                              onClick={() => setEditing(role)}
                            >
                              Edit
                            </PortalButton>
                          )}
                          {admin.permissions.includes('admin-accounts.archive') && (
                            <PortalButton
                              variant="danger"
                              disabled={Boolean(editing) || role.member_count > 0 || !grantable}
                              onClick={() => {
                                setDeleting(role)
                                setPassword('')
                                setActionError('')
                              }}
                            >
                              Delete
                            </PortalButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!roles.length && (
              <p className="p-5">
                No custom roles yet. Individual permissions can still be assigned to accounts.
              </p>
            )}
          </div>
        </>
      )}
      {deleting && (
        <ConfirmationDialog
          title="Delete custom role?"
          confirmLabel="Delete role"
          destructive
          busy={busy}
          confirmDisabled={!password}
          onClose={() => {
            setDeleting(null)
            setPassword('')
          }}
          onConfirm={() => void remove()}
        >
          <p className="mb-4">
            Delete {deleting.name}? This role must have no assigned Admin accounts.
          </p>
          <PortalField
            label="Your current password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          {actionError && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
              {actionError}
            </p>
          )}
        </ConfirmationDialog>
      )}
    </div>
  )
}
