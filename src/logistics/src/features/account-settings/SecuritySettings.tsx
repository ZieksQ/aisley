import { PasswordChangeForm } from "@aisley/ui/password-change";
import { LuLockKeyhole } from 'react-icons/lu';
import { TextField as Field } from "@aisley/ui";
import { ApiError } from '../../lib/api';
import { requestPasswordCode, updatePassword } from "../../lib/password-change";
import type { useAccountSettings } from './use-account-settings';
export function SecuritySettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const { logout, passwordSession, navigate, account } = settings;
  if (!account) return null;
  return <>
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[var(--settings-accent)] text-[var(--settings-accent)]">
          <LuLockKeyhole />
        </span>
        <div>
          <h3 className="font-semibold">Security</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Email changes and multi-factor authentication are not part of this release.</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <Field
          disabled
          id="account-password-email"
          label="Email address"
          value={account.email}
        />
        <PasswordChangeForm
          session={passwordSession}
          accent="blue"
          key={account.id}
          onError={(caught) => { if (caught instanceof ApiError && caught.status === 401) { void logout().catch(() => undefined).finally(() => navigate('/login', { replace: true })); } }}
          requestCode={requestPasswordCode}
          updatePassword={updatePassword}
          sessionDescription="This browser stays signed in. All Logistics API access tokens are revoked."
        />
      </div>
    </section></>;
}
