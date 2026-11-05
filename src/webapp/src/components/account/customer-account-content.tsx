"use client";
import { CustomerAvatar } from "@/components/account/customer-avatar";
import { IdImageSection } from "@/components/account/id-image-section";
import { PromotionPreferenceSection } from "@/components/account/promotion-preference-section";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountSection, AccountSettings, AccountSettingsState } from '@aisley/ui/account-settings';
import { usePathname, useSearchParams } from 'next/navigation';
import { ProfileSettings } from './settings/ProfileSettings';
import { SecuritySettings } from './settings/SecuritySettings';
import { useAccountSettings } from './settings/use-account-settings';
const sections = [
  {
    id: "profile",
    label: "Profile",
    description: "Update your personal details and profile photo."
  },
  {
    id: "id-image",
    label: "ID image",
    description: "Manage your optional private ID image. Only you can view it."
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Choose whether to receive optional in-app promotional messages."
  },
  {
    id: "security",
    label: "Security",
    description: "Protect your sign-in with a password confirmed by an emailed code. Your login email is read-only."
  }
];
export function CustomerAccountContent() {
  const { auth } = useAuth();
  return <AccountEditor key={auth.status === "authenticated" ? auth.customer.id : "signedout"} />;
}
function AccountEditor() {
  const settings = useAccountSettings();
  const { account } = settings;
  const params = useSearchParams(); const pathname = usePathname();
  const select = (id: string) => { const next = new URLSearchParams(params.toString()); next.set('section', id); window.history.pushState(null, '', pathname + '?' + next.toString() + window.location.hash); };
  const active = sections.some(section => section.id === params.get('section')) ? params.get('section') : 'profile';
  if (settings.status === "loading") return <AccountSettingsState />;
  if (settings.status === "error" || !account) return <AccountSettingsState error={settings.loadError || 'Account settings are unavailable.'} onRetry={() => { settings.setStatus('loading'); settings.setLoadError(''); settings.setReloadKey(value => value + 1); }} />;
  if (!account) return null;
  const name = [account.profile.firstName, account.profile.lastName].filter(Boolean).join(' ');
  return <AccountSettings
    sections={sections}
    activeSection={active}
    onSectionChange={select}
    name={name}
    email={account.email}
    role="Customer"
    status={account.status}
    avatar={<CustomerAvatar
      className="size-14"
      displayName={name}
      photoUrl={account.profile.profilePhotoUrl}
    />}
    customer
  >
    <AccountSection id="profile">
      <ProfileSettings settings={settings} />
    </AccountSection>
    <AccountSection id="id-image">
      <IdImageSection account={account} onUpdated={settings.applyPhotoUpdate} />
    </AccountSection>
    <AccountSection id="preferences">
      <PromotionPreferenceSection />
    </AccountSection>
    <AccountSection id="security" sensitive>
      <SecuritySettings settings={settings} />
    </AccountSection>
  </AccountSettings>;
}
