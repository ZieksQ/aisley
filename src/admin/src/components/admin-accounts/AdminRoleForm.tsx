import { useState } from 'react'
import type { FormEvent } from 'react'
import { PortalButton, PortalField } from '@aisley/ui/portal'
import { PermissionEditor } from './PermissionEditor'
import { UnsavedAdminChanges } from './UnsavedAdminChanges'
import { ApiError } from '../../lib/api'
import { saveAdminRole } from '../../lib/adminAccounts'
import type { AdminRole, PermissionDefinition } from '../../types/adminAccounts'

export function AdminRoleForm({
  role,
  catalog,
  grantable,
  onSaved,
  onCancel,
}: {
  role?: AdminRole
  catalog: PermissionDefinition[]
  grantable: string[]
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [permissions, setPermissions] = useState(role?.permissions ?? [])
  const [password, setPassword] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setErrors({})
    try {
      await saveAdminRole(
        {
          name,
          permissions,
          current_password: password,
          ...(role ? { revision: role.revision } : {}),
        },
        role?.id,
      )
      setDirty(false)
      setPassword('')
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this role.')
      if (caught instanceof ApiError) setErrors(caught.errors)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="portal-panel space-y-5 p-5" onSubmit={(event) => void submit(event)}>
      <UnsavedAdminChanges dirty={dirty && !busy} />
      <h2 className="text-lg font-semibold">{role ? `Edit ${role.name}` : 'Create custom role'}</h2>
      <p className="text-sm">
        Role changes apply immediately to every assigned Admin. You can grant only permissions you
        hold.
      </p>
      <fieldset className="space-y-5" disabled={busy}>
        <PortalField
          label="Role name"
          required
          maxLength={100}
          value={name}
          error={errors.name?.[0]}
          onChange={(event) => {
            setName(event.target.value)
            setDirty(true)
          }}
        />
        <PermissionEditor
          catalog={catalog}
          selected={permissions}
          grantable={grantable}
          onChange={(value) => {
            setPermissions(value)
            setDirty(true)
          }}
        />
        {errors.permissions && <p role="alert">{errors.permissions[0]}</p>}
        <PortalField
          label="Your current password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={errors.current_password?.[0]}
          onChange={(event) => setPassword(event.target.value)}
        />
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <PortalButton type="submit" variant="primary" isLoading={busy}>
          Save role
        </PortalButton>
        <PortalButton
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm('Discard unsaved role changes?')) onCancel()
          }}
        >
          Cancel
        </PortalButton>
      </div>
    </form>
  )
}
