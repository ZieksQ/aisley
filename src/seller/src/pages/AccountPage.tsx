import { AccountSection, AccountSettings, AccountSettingsState } from '@aisley/ui/account-settings';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { PickupAddressBook } from '../components/PickupAddressBook';
import { SellerAvatar } from '../components/SellerAvatar';
import { ProfileSettings } from '../features/account-settings/ProfileSettings';
import { SecuritySettings } from '../features/account-settings/SecuritySettings';
import { StorefrontSettings } from '../features/account-settings/StorefrontSettings';
import { useAccountSettings } from '../features/account-settings/use-account-settings';
const sections = [
  {
    id: "profile",
    label: "Profile",
    description: "Update your personal details and profile photo."
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "Manage your Shop’s public details, cover image, and vacation availability."
  },
  {
    id: "pickup-addresses",
    label: "Pickup addresses",
    description: "Manage the addresses couriers use to collect your Shop’s orders."
  },
  {
    id: "security",
    label: "Security",
    description: "Protect your sign-in with a password confirmed by an emailed code."
  }
];
export function AccountPage() {
  const { seller } = useAuth();
  return <AccountEditor key={seller?.id ?? 'signedout'} />;
}
function AccountEditor() {
  const settings = useAccountSettings();
  const { account } = settings;
  const [params, setParams] = useSearchParams();
  const select = (id: string) => { setParams((previous) => { const next = new URLSearchParams(previous); next.set('section', id); return next; }, { preventScrollReset: true }); };
  const active = sections.some(section => section.id === params.get('section')) ? params.get('section') : 'profile';
  const { setErrors, setMessage, setEmailPassword } = settings;
  useEffect(() => {
    setErrors({});
    setMessage('');
    if (active !== 'security') {
      setEmailPassword('');
    }
  }, [active, setErrors, setMessage, setEmailPassword]);
  if (settings.isLoading) return <AccountSettingsState headingLevel={2} />;
  if (settings.loadError || !account) return <AccountSettingsState headingLevel={2} error={settings.loadError || 'Account settings are unavailable.'} onRetry={() => settings.setReload(value => value + 1)} />;
  if (!account) return null;
  const name = [account.profile.first_name, account.profile.last_name].filter(Boolean).join(' ');
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  return <AccountSettings
    headingLevel={2}
    sections={sections}
    activeSection={active}
    onSectionChange={select}
    name={name}
    email={account.email}
    role="Seller"
    status={account.status}
    avatar={<SellerAvatar
      className="size-14"
      initials={initials}
      photoUrl={account.profile.profile_photo_url}
    />}
  >
    <AccountSection id="profile">
      <ProfileSettings settings={settings} />
    </AccountSection>
    <AccountSection id="storefront">
      <StorefrontSettings settings={settings} />
    </AccountSection>
    <AccountSection id="pickup-addresses">
      <PickupAddressBook />
    </AccountSection>
    <AccountSection id="security" sensitive>
      <SecuritySettings settings={settings} />
    </AccountSection>
  </AccountSettings>;
}
