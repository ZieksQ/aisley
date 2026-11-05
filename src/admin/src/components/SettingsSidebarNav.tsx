import { SettingsNavigation } from '@aisley/ui/portal'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function SettingsSidebarNav() {
  const { pathname } = useLocation()
  const { admin } = useAuth()
  return <SettingsNavigation pathname={pathname} renderLink={props => <Link {...props} />}
    showBilling={admin?.permissions.includes('finance.view') ?? false} showNotifications={admin?.permissions.includes('notifications.view') ?? false} />
}
