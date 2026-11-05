import { AccountSettingsFeedback } from '@aisley/ui/account-settings';
import { TextField } from './fields';
import type { useAccountSettings } from './use-account-settings';
export function SecuritySettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const { email, setEmail, emailPassword, setEmailPassword, passwords, setPasswords, busy, errors, saveEmail, savePassword, account } = settings;
  if (!account) return null;
  return <>
    <AccountSettingsFeedback error={["email", "password"].includes(settings.feedbackAction) ? settings.errors.form?.[0] ?? Object.values(settings.errors).flat()[0] : null} message={["email", "password"].includes(settings.feedbackAction) ? settings.message : null} />
    <div className="space-y-6">
      <form className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" onSubmit={saveEmail}>
        <h3 className="font-semibold">Email address</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Used to sign in to the Admin application.</p>
        <div className="mt-4 space-y-4">
          <TextField
            autoComplete="email"
            label="Email"
            name="email"
            onChange={setEmail}
            required
            type="email"
            value={email}
            errors={settings.feedbackAction === "email" ? errors : {}}
          />
          <TextField
            autoComplete="current-password"
            label="Current password"
            name="current_password"
            onChange={setEmailPassword}
            required
            type="password"
            value={emailPassword}
            errors={settings.feedbackAction === "email" ? errors : {}}
          />
        </div>
        <button className="mt-5 h-10 w-full rounded-lg account-settings-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== null}>
          {busy === 'email' ? 'Updating…' : 'Update email'}
        </button>
      </form>
      <form className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" onSubmit={savePassword}>
        <h3 className="font-semibold">Password</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use at least 8 characters with uppercase, lowercase, and a number.</p>
        <div className="mt-4 space-y-4">
          <TextField
            autoComplete="current-password"
            label="Current password"
            name="current_password"
            onChange={(value) => setPasswords({ ...passwords, current_password: value })}
            required
            type="password"
            value={passwords.current_password}
            errors={settings.feedbackAction === "password" ? errors : {}}
          />
          <TextField
            autoComplete="new-password"
            label="New password"
            name="password"
            onChange={(value) => setPasswords({ ...passwords, password: value })}
            required
            type="password"
            value={passwords.password}
            errors={settings.feedbackAction === "password" ? errors : {}}
          />
          <TextField
            autoComplete="new-password"
            label="Confirm new password"
            name="password_confirmation"
            onChange={(value) => setPasswords({ ...passwords, password_confirmation: value })}
            required
            type="password"
            value={passwords.password_confirmation}
            errors={settings.feedbackAction === "password" ? errors : {}}
          />
        </div>
        <button className="mt-5 h-10 w-full rounded-lg account-settings-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== null}>
          {busy === 'password' ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div></>;
}
