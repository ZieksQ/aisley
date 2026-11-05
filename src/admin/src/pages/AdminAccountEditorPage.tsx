import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PortalButton } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { AdminAccountForm } from '../components/admin-accounts/AdminAccountForm'
import { AdminAccountActions } from '../components/admin-accounts/AdminAccountActions'
import {
  fetchAdminRoles,
  fetchManagedAdmin,
  fetchPermissions,
  saveAdminAccount,
} from '../lib/adminAccounts'
import type { AdminRole, ManagedAdmin, PermissionDefinition } from '../types/adminAccounts'

export function AdminAccountEditorPage() {
  const { admin, refreshAdmin } = useAuth()
  const { adminId } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState<ManagedAdmin | undefined>()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setAccount(undefined)
    setNotice('')
    Promise.all([
      fetchPermissions(controller.signal),
      fetchAdminRoles(controller.signal),
      adminId ? fetchManagedAdmin(adminId, controller.signal) : Promise.resolve(undefined),
    ])
      .then(([permissions, roleData, target]) => {
        if (!controller.signal.aborted) {
          setCatalog(permissions.data)
          setRoles(roleData.data)
          setAccount(target?.data)
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : 'Unable to load this Admin.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [adminId, retry, admin?.id])
  const refresh = useCallback(async () => {
    try {
      if (adminId) setAccount((await fetchManagedAdmin(adminId)).data)
      await refreshAdmin()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The change was saved, but account information could not be refreshed. Try again.',
      )
    }
  }, [adminId, refreshAdmin])
  if (!admin) return null
  const eligible =
    !account ||
    (account.id !== admin.id &&
      (admin.is_super_admin ||
        (!account.is_super_admin &&
          account.permissions.every((slug) => admin.permissions.includes(slug)))))
  const canEdit =
    eligible &&
    admin.permissions.includes(account ? 'admin-accounts.update' : 'admin-accounts.create')
  return (
    <div className="portal-page space-y-5">
      <Link className="portal-button" to="/admin-accounts">
        Back to Admin accounts
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold">
          {adminId ? 'Admin account' : 'Create Admin account'}
        </h2>
        {account && (
          <p className="text-sm">
            {account.archived_at
              ? 'Archived'
              : account.status === 'active'
              ? 'Active'
              : 'Suspended'}{' '}
            · {account.setup_required ? 'Setup pending' : 'Setup complete'}
          </p>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {account?.setup_required && (
        <p className="text-sm">
          This Admin must verify their email before using the workspace. For a newly created
          account, share its temporary password directly; the Admin will replace it during setup.
        </p>
      )}
      {loading ? (
        <p role="status">Loading account information…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <PortalButton onClick={() => setRetry((value) => value + 1)}>Try again</PortalButton>
        </div>
      ) : (
        <>
          {account?.id === admin.id && (
            <p className="text-sm">
              Use Account settings to edit your own profile. Your own privileges cannot be changed
              here.
            </p>
          )}
          {account && eligible && !account.is_initial_admin && (
            <AdminAccountActions
              account={account}
              permissions={admin.permissions}
              onChanged={refresh}
            />
          )}
          {!canEdit && (
            <p className="text-sm">This account is read-only with your current permissions.</p>
          )}
          <AdminAccountForm
            key={`${adminId ?? 'new'}:${account?.revision ?? 0}:${canEdit}:${admin.permissions.join(
              ',',
            )}`}
            account={account}
            roles={roles}
            catalog={catalog}
            grantable={admin.permissions}
            superAdmin={admin.is_super_admin}
            readOnly={!canEdit}
            onSave={async (draft) => {
              const response = await saveAdminAccount(draft, adminId)
              setAccount(response.data)
              setNotice(
                adminId
                  ? 'Admin account updated.'
                  : 'Admin created. Share the temporary password directly; first-login setup is required.',
              )
              await refreshAdmin()
              if (!adminId) navigate(`/admin-accounts/${response.data.id}`, { replace: true })
            }}
          />
          <PortalButton
            onClick={() => {
              if (window.confirm('Reload account information? Unsaved changes will be discarded.'))
                setRetry((value) => value + 1)
            }}
          >
            Reload account information
          </PortalButton>
        </>
      )}
    </div>
  )
}
