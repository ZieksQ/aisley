import { AccountSection, AccountSettings, AccountSettingsState } from '@aisley/ui/account-settings';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { LogisticsAvatar } from '../components/LogisticsAvatar';
import { OrganizationSettings } from '../features/account-settings/OrganizationSettings';
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
    id: "organization",
    label: "Organization & hub",
    description: "Maintain your organization’s identity and correct the entrance pin for its sole approved hub."
  },
  {
    id: "security",
    label: "Security",
    description: "Protect your sign-in with a password confirmed by an emailed code. Your login email is read-only."
  }
];
export function AccountPage() {
  const { logistics } = useAuth();
  return <AccountEditor key={logistics?.id ?? 'signedout'} />;
}
function AccountEditor() {
  const settings = useAccountSettings();
  const { account } = settings;
  const [params, setParams] = useSearchParams();
  const select = (id: string) => { setParams((previous) => { const next = new URLSearchParams(previous); next.set('section', id); return next; }, { preventScrollReset: true }); };
  const active = sections.some(section => section.id === params.get('section')) ? params.get('section') : 'profile';
  if (settings.loading) return <AccountSettingsState headingLevel={2} />;
  if (settings.loadingError || !account) return <AccountSettingsState headingLevel={2} error={settings.loadingError || 'Account settings are unavailable.'} onRetry={() => void settings.load()} />;
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
    role="Logistics"
    status={account.status}
    avatar={<LogisticsAvatar
      className="size-14"
      initials={initials}
      photoUrl={account.profile.profile_photo_url}
    />}
  >
    <AccountSection id="profile">
      <ProfileSettings settings={settings} />
    </AccountSection>
    <AccountSection id="organization">
      <OrganizationSettings settings={settings} />
    </AccountSection>
    <AccountSection id="security" sensitive>
      <SecuritySettings settings={settings} />
    </AccountSection>
  </AccountSettings>;
}
