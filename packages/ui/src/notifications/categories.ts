export type NotificationRole = 'customer' | 'admin' | 'seller' | 'logistics'

export type NotificationCategoryOption = {
  key: string
  label: string
}

const roleCategories: Record<NotificationRole, NotificationCategoryOption[]> = {
  customer: [
    { key: 'orders', label: 'Orders' },
    { key: 'support', label: 'Support' },
    { key: 'promotions', label: 'Promotions' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'questions-reviews', label: 'Questions & reviews' },
    { key: 'other', label: 'Other' },
  ],
  admin: [
    { key: 'registrations', label: 'Registrations' },
    { key: 'support', label: 'Support' },
    { key: 'finance', label: 'Finance' },
    { key: 'other', label: 'Other' },
  ],
  seller: [
    { key: 'orders', label: 'Orders' },
    { key: 'pickups', label: 'Pickups' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'questions-reviews', label: 'Questions & reviews' },
    { key: 'support', label: 'Support' },
    { key: 'other', label: 'Other' },
  ],
  logistics: [
    { key: 'pickups', label: 'Pickups' },
    { key: 'couriers', label: 'Couriers' },
    { key: 'deliveries', label: 'Deliveries' },
    { key: 'linehaul', label: 'Linehaul' },
    { key: 'finance', label: 'Finance' },
    { key: 'support', label: 'Support' },
    { key: 'other', label: 'Other' },
  ],
}

function normalizeKey(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9_-]+$/i.test(value) ? value : null
}

export function notificationCategoryOptions(
  role: NotificationRole,
  serverCategories?: unknown,
): NotificationCategoryOption[] {
  const labels = new Map(roleCategories[role].map(({ key, label }) => [key, label]))
  const additional: NotificationCategoryOption[] = []

  if (Array.isArray(serverCategories)) {
    for (const raw of serverCategories) {
      if (typeof raw !== 'object' || raw === null) continue
      const option = raw as { key?: unknown; label?: unknown }
      const key = normalizeKey(option.key)
      const label = typeof option.label === 'string' ? option.label.trim() : ''
      if (!key || !label) continue
      if (labels.has(key)) labels.set(key, label)
      else if (!additional.some((item) => item.key === key)) additional.push({ key, label })
    }
  }

  const standard = roleCategories[role]
    .filter(({ key }) => key !== 'other')
    .map(({ key, label }) => ({ key, label: labels.get(key) ?? label }))
  const other = { key: 'other', label: labels.get('other') ?? 'Other' }
  return [...standard, ...additional.filter(({ key }) => key !== 'other'), other]
}

export function notificationCategoryLabel(
  category: string | null | undefined,
  categoryLabel: string | null | undefined,
  role: NotificationRole,
): string {
  const providedLabel = categoryLabel?.trim()
  if (providedLabel) return providedLabel
  const key = normalizeKey(category)
  if (!key) return 'Other'
  return notificationCategoryOptions(role).find((option) => option.key === key)?.label ?? 'Other'
}

export function isNotificationCategory(
  category: string | null | undefined,
  role: NotificationRole,
): boolean {
  return Boolean(category && notificationCategoryOptions(role).some((option) => option.key === category))
}
