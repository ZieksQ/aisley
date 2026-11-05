import { useState } from 'react'
import { ConfirmationDialog, PortalButton, PortalField } from '@aisley/ui/portal'
import { actOnAdmin } from '../../lib/adminAccounts'
import type { ManagedAdmin } from '../../types/adminAccounts'

export function AdminAccountActions({
  account,
  permissions,
  onChanged,
}: {
  account: ManagedAdmin
  permissions: string[]
  onChanged: () => Promise<void>
}) {
  const [action, setAction] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const actions = [
    ...(!account.archived_at && account.status === 'active'
      ? [{ key: 'suspend', label: 'Suspend' }]
      : []),
    ...(account.archived_at || account.status === 'suspended'
      ? [{ key: 'restore', label: 'Restore' }]
      : []),
    ...(!account.archived_at ? [{ key: 'archive', label: 'Archive' }] : []),
  ].filter((item) => permissions.includes(`admin-accounts.${item.key}`))
  async function confirm() {
    if (!action || busy) return
    setBusy(true)
    setError('')
    try {
      await actOnAdmin(account, action, password)
      setAction(null)
      setPassword('')
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to change this account.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((item) => (
        <PortalButton
          key={item.key}
          variant={item.key === 'restore' ? 'default' : 'danger'}
          onClick={() => {
            setAction(item.key)
            setPassword('')
            setError('')
          }}
        >
          {item.label} account
        </PortalButton>
      ))}
      {action && (
        <ConfirmationDialog
          title={`${actions.find((item) => item.key === action)?.label ?? 'Update'} Admin account?`}
          confirmLabel="Confirm account change"
          destructive={action !== 'restore'}
          busy={busy}
          confirmDisabled={!password}
          onClose={() => {
            setAction(null)
            setPassword('')
          }}
          onConfirm={() => void confirm()}
        >
          <p className="mb-4 break-words">
            {account.email}.{' '}
            {action === 'restore'
              ? 'The Admin can sign in again; required setup still applies.'
              : 'The Admin will lose access immediately. Existing sessions will be invalidated.'}
          </p>
          <PortalField
            label="Your current password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          )}
        </ConfirmationDialog>
      )}
    </div>
  )
}
