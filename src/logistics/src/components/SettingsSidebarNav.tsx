import { SettingsNavigation } from '@aisley/ui/portal'
import { Link, useLocation } from 'react-router-dom'

export function SettingsSidebarNav() {
  const { pathname } = useLocation()
  return <SettingsNavigation pathname={pathname} renderLink={props => <Link {...props} />} />
}
