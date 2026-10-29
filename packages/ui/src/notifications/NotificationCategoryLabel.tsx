import { notificationCategoryLabel, type NotificationRole } from './categories'

export function NotificationCategoryLabel({
  category,
  categoryLabel,
  role,
  className = '',
}: {
  category?: string | null
  categoryLabel?: string | null
  role: NotificationRole
  className?: string
}) {
  return (
    <span className={`text-xs font-medium text-[#5F6368] dark:text-zinc-400 ${className}`}>
      {notificationCategoryLabel(category, categoryLabel, role)}
    </span>
  )
}
