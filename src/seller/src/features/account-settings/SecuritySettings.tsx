import { AccountSettingsFeedback } from '@aisley/ui/account-settings';
import { PasswordChangeForm } from "@aisley/ui/password-change";
import { requestPasswordCode, updatePassword } from "../../lib/password-change";
import { primaryButtonClass, sectionClass, TextField } from './fields';
import type { useAccountSettings } from './use-account-settings';
export function SecuritySettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const { passwordSession, account, email, setEmail, emailPassword, setEmailPassword, busy, errors, saveEmail } = settings;
  if (!account) return null;
  return <>
    <AccountSettingsFeedback error={["email", "password"].includes(settings.feedbackAction) ? settings.errors.form?.[0] ?? Object.values(settings.errors).flat()[0] : null} message={["email", "password"].includes(settings.feedbackAction) ? settings.message : null} />
    <section aria-labelledby="security-heading" className={`${sectionClass} `}>
      <h3 className="font-semibold" id="security-heading">Sign-in security</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Two-factor authentication is not available yet. Current-password confirmation protects email edits; password edits also require an emailed code.</p>
      <div className="mt-5 grid gap-6 xl:grid-cols-1">
        <form className="account-settings-security-card" onSubmit={saveEmail}>
          <h4 className="font-medium">Email address</h4>
          <div className="mt-4 space-y-4">
            <TextField
              autoComplete="email"
              errors={errors}
              label="Email"
              name="email"
              onChange={setEmail}
              required
              type="email"
              value={email}
            />
            <TextField
              autoComplete="current-password"
              errors={errors}
              label="Current password"
              name="current_password"
              onChange={setEmailPassword}
              required
              type="password"
              value={emailPassword}
            />
          </div>
          <button className={`${primaryButtonClass} mt-5 w-full`} disabled={busy !== null}>
            {busy === 'email' ? 'Updating…' : 'Update email'}
          </button>
        </form>
        <div className="account-settings-security-card">
          <PasswordChangeForm
            session={passwordSession}
            key={account.id}
            requestCode={requestPasswordCode}
            updatePassword={updatePassword}
            sessionDescription="This browser stays signed in. API access tokens are revoked."
          />
        </div>
      </div>
    </section></>;
}
