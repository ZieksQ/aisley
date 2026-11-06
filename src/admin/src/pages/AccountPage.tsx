import { AccountSection, AccountSettings, AccountSettingsState } from '@aisley/ui/account-settings';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AdminAvatar } from '../components/AdminAvatar';
import { ProfileSettings } from '../features/account-settings/ProfileSettings';
import { SecuritySettings } from '../features/account-settings/SecuritySettings';
import { useAccountSettings } from '../features/account-settings/use-account-settings';
const sections = [
  {
    id: "profile",
    label: "Profile",
    description: "Update your personal details and profile photo."
  },
  {
    id: "security",
    label: "Security",
    description: "Manage your login email and password. Changing your email requires verification before returning to the workspace."
  }
];
export function AccountPage() {
  const { admin } = useAuth();
  return <AccountEditor key={admin?.id ?? 'signedout'} />;
}
function AccountEditor() {
  const settings = useAccountSettings();
  const { account } = settings;
  const [params, setParams] = useSearchParams();
  const select = (id: string) => { setParams((previous) => { const next = new URLSearchParams(previous); next.set('section', id); return next; }, { preventScrollReset: true }); };
  const active = sections.some(section => section.id === params.get('section')) ? params.get('section') : 'profile';
  const { setErrors, setMessage, setEmailPassword, setPasswords } = settings;
  useEffect(() => {
    setErrors({});
    setMessage('');
    if (active !== 'security') {
      setEmailPassword('');
      setPasswords({ current_password: '', password: '', password_confirmation: '' });
    }
  }, [active, setErrors, setMessage, setEmailPassword, setPasswords]);
  if (settings.isLoading) return <AccountSettingsState headingLevel={2} title="Account" />;
  if (settings.loadError || !account) return <AccountSettingsState headingLevel={2} title="Account" error={settings.loadError || 'Account settings are unavailable.'} onRetry={() => settings.setReload(value => value + 1)} />;
  if (!account) return null;
  const name = [account.profile.first_name, account.profile.last_name].filter(Boolean).join(' ');
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  return <AccountSettings
    headingLevel={2} title="Account"
    sections={sections}
    activeSection={active}
    onSectionChange={select}
    name={name}
    email={account.email}
    role="Admin"
    status={account.status}
    avatar={<AdminAvatar
      className="size-14"
      initials={initials}
      photoUrl={account.profile.profile_photo_url}
    />}
  >
    <AccountSection id="profile">
      <ProfileSettings settings={settings} />
    </AccountSection>
    <AccountSection id="security" sensitive>
      <SecuritySettings settings={settings} />
    </AccountSection>
  </AccountSettings>;
}
