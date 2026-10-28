import { notificationCategoryOptions, type NotificationCategoryOption, type NotificationRole } from './categories'

export type NotificationStatus = 'all' | 'unread' | 'read'
export type NotificationCategory = string

const paletteClasses = {
  purple: {
    selected: 'border-[#4C1268] bg-[#4C1268] text-white hover:bg-[#3D0E54] dark:border-[#6D28D9] dark:bg-[#2E1B3B] dark:text-[#C4B5FD] dark:hover:bg-[#3B234B]',
    idle: 'border-[#CFC4D2] bg-white text-[#514656] hover:bg-[#F6F0F8] dark:border-white/15 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[0.05]',
    focus: 'focus-visible:outline-[#4C1268] dark:focus-visible:outline-[#C4B5FD]',
  },
  blue: {
    selected: 'border-[#2563EB] bg-[#2563EB] text-white hover:bg-[#1D4ED8] dark:border-[#93C5FD] dark:bg-[#172D4A] dark:text-[#93C5FD] dark:hover:bg-[#203C5F]',
    idle: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[0.05]',
    focus: 'focus-visible:outline-[#2563EB] dark:focus-visible:outline-[#93C5FD]',
  },
}

export function NotificationFilters({
  role,
  status,
  category,
  categories,
  palette = 'purple',
  onStatusChange,
  onCategoryChange,
}: {
  role: NotificationRole
  status: NotificationStatus
  category: NotificationCategory
  categories?: readonly NotificationCategoryOption[]
  palette?: 'purple' | 'blue'
  onStatusChange: (status: NotificationStatus) => void
  onCategoryChange: (category: NotificationCategory) => void
}) {
  const options = categories ?? notificationCategoryOptions(role)
  const styles = paletteClasses[palette]
  const choices = [
    { value: 'all' as const, label: 'All' },
    { value: 'unread' as const, label: 'Unread' },
    { value: 'read' as const, label: 'Read' },
  ]

  const buttonClass = (selected: boolean) =>
    `min-h-11 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.focus} ${selected ? styles.selected : styles.idle}`

  return (
    <div className="grid gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-sm font-medium text-[#514656] dark:text-zinc-300 sm:w-20">Status</span>
        <div aria-label="Notification status" className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group">
          {choices.map((choice) => (
            <button
              aria-pressed={status === choice.value}
              className={buttonClass(status === choice.value)}
              key={choice.value}
              onClick={() => onStatusChange(choice.value)}
              type="button"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-sm font-medium text-[#514656] dark:text-zinc-300 sm:w-20">Category</span>
        <div aria-label="Notification category" className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group">
          <button
            aria-pressed={category === 'all'}
            className={buttonClass(category === 'all')}
            onClick={() => onCategoryChange('all')}
            type="button"
          >
            All categories
          </button>
          {options.map((option) => (
            <button
              aria-pressed={category === option.key}
              className={buttonClass(category === option.key)}
              key={option.key}
              onClick={() => onCategoryChange(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
