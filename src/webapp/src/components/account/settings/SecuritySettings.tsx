"use client";
import {
  requestCustomerPasswordCode,
  updateCustomerPassword
} from "@/lib/account/client";
import { PasswordChangeForm } from "@aisley/ui/password-change";
import type { useAccountSettings } from './use-account-settings';
export function SecuritySettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const { passwordSession, account } = settings;
  if (!account) return null;
  return <>
    <section className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-medium">Email address</p>
        <p className="mt-1 text-sm">
          {account.email}</p>
        <p className="mt-1 text-sm text-[var(--settings-muted)]">Your login email cannot be changed here.</p>
      </div>
      <PasswordChangeForm
        session={passwordSession}
        key={account.id}
        requestCode={requestCustomerPasswordCode}
        updatePassword={updateCustomerPassword}
        sessionDescription="This browser stays signed in. Other app access tokens are revoked."
      />
    </section></>;
}
