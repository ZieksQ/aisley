export function routePermission(path: string): string | undefined {
  if (path === '/notification-campaigns/new') return 'notification-campaigns.manage'
  if (path === '/admin-accounts/new') return 'admin-accounts.create'
  const prefixes: [string, string][] = [
    ['/admin-accounts', 'admin-accounts.view'],
    ['/admin-roles', 'admin-accounts.view'],
    ['/registrations', 'registrations.view'],
    ['/users', 'users.view'],
    ['/seller-compliance', 'seller_compliance.manage'],
    ['/support-tickets', 'support-tickets.view'],
    ['/notification-campaigns', 'notification-campaigns.view'],
    ['/notifications', 'notifications.view'],
    ['/vouchers', 'vouchers.view'],
    ['/finance-holds', 'finance.view'],
    ['/finance', 'finance.view'],
    ['/settings/billing', 'finance.view'],
    ['/pricing-and-fees', 'finance.view'],
    ['/audit-logs', 'audit-logs.view'],
    ['/platform-settings', 'platform-settings.view'],
    ['/feature-controls', 'platform-settings.view'],
  ]
  return prefixes.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1]
}
