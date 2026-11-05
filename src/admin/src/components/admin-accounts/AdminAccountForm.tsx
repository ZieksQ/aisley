import { useState } from 'react'
import type { FormEvent } from 'react'
import { PortalButton, PortalField } from '@aisley/ui/portal'
import { ApiError } from '../../lib/api'
import { PermissionEditor } from './PermissionEditor'
import { UnsavedAdminChanges } from './UnsavedAdminChanges'
import type {
  AdminAccountDraft,
  AdminRole,
  ManagedAdmin,
  PermissionDefinition,
} from '../../types/adminAccounts'

export function AdminAccountForm({
  account,
  roles,
  catalog,
  grantable,
  superAdmin,
  readOnly,
  onSave,
}: {
  account?: ManagedAdmin
  roles: AdminRole[]
  catalog: PermissionDefinition[]
  grantable: string[]
  superAdmin: boolean
  readOnly: boolean
  onSave: (draft: AdminAccountDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<AdminAccountDraft>({
    email: account?.email ?? '',
    first_name: account?.profile?.first_name ?? '',
    middle_name: account?.profile?.middle_name ?? '',
    last_name: account?.profile?.last_name ?? '',
    contact_number: account?.profile?.contact_number ?? '',
    permissions: account?.direct_permissions ?? [],
    role_ids: account?.roles.map((role) => role.id) ?? [],
    is_super_admin: account?.is_super_admin ?? false,
    current_password: '',
    ...(account ? { revision: account.revision } : { password: '', password_confirmation: '' }),
  })
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const change = <K extends keyof AdminAccountDraft>(key: K, value: AdminAccountDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }
  const inherited = roles
    .filter((role) => draft.role_ids.includes(role.id))
    .flatMap((role) => role.permissions)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || readOnly) return
    setBusy(true)
    setError('')
    setErrors({})
    try {
      await onSave(draft)
      setDirty(false)
      setDraft((current) => ({
        ...current,
        current_password: '',
        password: '',
        password_confirmation: '',
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this Admin.')
      if (caught instanceof ApiError) setErrors(caught.errors)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="space-y-6" onSubmit={(event) => void submit(event)}>
      <UnsavedAdminChanges dirty={dirty && !busy && !readOnly} />
      <fieldset className="portal-panel space-y-5 p-5" disabled={readOnly || busy}>
        <legend className="font-semibold">Account information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <PortalField
            label="First name"
            required
            maxLength={255}
            value={draft.first_name}
            error={errors.first_name?.[0]}
            onChange={(event) => change('first_name', event.target.value)}
          />
          <PortalField
            label="Middle name (optional)"
            maxLength={255}
            value={draft.middle_name}
            error={errors.middle_name?.[0]}
            onChange={(event) => change('middle_name', event.target.value)}
          />
          <PortalField
            label="Last name"
            required
            maxLength={255}
            value={draft.last_name}
            error={errors.last_name?.[0]}
            onChange={(event) => change('last_name', event.target.value)}
          />
          <PortalField
            label="Contact number (optional)"
            type="tel"
            maxLength={32}
            value={draft.contact_number}
            error={errors.contact_number?.[0]}
            onChange={(event) => change('contact_number', event.target.value)}
          />
          <PortalField
            label="Email address"
            type="email"
            autoComplete="off"
            required
            maxLength={255}
            value={draft.email}
            error={errors.email?.[0]}
            onChange={(event) => change('email', event.target.value)}
          />
        </div>
        {!account && (
          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField
              label="Temporary password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={draft.password}
              error={errors.password?.[0]}
              hint="At least 8 characters, including uppercase, lowercase and a number. Share it directly with the new Admin."
              onChange={(event) => change('password', event.target.value)}
            />
            <PortalField
              label="Confirm temporary password"
              type="password"
              autoComplete="new-password"
              required
              value={draft.password_confirmation}
              error={errors.password_confirmation?.[0]}
              onChange={(event) => change('password_confirmation', event.target.value)}
            />
          </div>
        )}
      </fieldset>
      <fieldset className="portal-panel space-y-5 p-5" disabled={readOnly || busy}>
        <legend className="font-semibold">Access</legend>
        {superAdmin && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              className="size-4 accent-[#4C1268]"
              type="checkbox"
              checked={draft.is_super_admin}
              disabled={account?.is_initial_admin}
              onChange={(event) => change('is_super_admin', event.target.checked)}
            />
            Super admin — all current and future permissions
          </label>
        )}
        <fieldset className="space-y-2" disabled={draft.is_super_admin}>
          <legend className="font-semibold">Custom roles</legend>
          {!roles.length && <p className="text-sm">No custom roles have been created.</p>}
          {roles.map((role) => (
            <label className="flex min-h-11 items-center gap-3 text-sm" key={role.id}>
              <input
                className="size-4 accent-[#4C1268]"
                type="checkbox"
                checked={draft.role_ids.includes(role.id)}
                disabled={role.permissions.some((slug) => !grantable.includes(slug))}
                onChange={(event) =>
                  change(
                    'role_ids',
                    event.target.checked
                      ? [...draft.role_ids, role.id]
                      : draft.role_ids.filter((id) => id !== role.id),
                  )
                }
              />
              {role.name}
            </label>
          ))}
        </fieldset>
        <PermissionEditor
          catalog={catalog}
          selected={draft.permissions}
          inherited={inherited}
          grantable={grantable}
          onChange={(value) => change('permissions', value)}
          disabled={draft.is_super_admin}
        />
        {(errors.permissions || errors.role_ids) && (
          <p role="alert">{errors.permissions?.[0] ?? errors.role_ids?.[0]}</p>
        )}
      </fieldset>
      {!readOnly && (
        <div className="portal-panel space-y-4 p-5">
          <PortalField
            label="Your current password"
            type="password"
            autoComplete="current-password"
            required
            value={draft.current_password}
            disabled={busy}
            error={errors.current_password?.[0]}
            onChange={(event) => change('current_password', event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <PortalButton type="submit" variant="primary" isLoading={busy}>
            {account ? 'Save changes' : 'Create Admin account'}
          </PortalButton>
        </div>
      )}
    </form>
  )
}
