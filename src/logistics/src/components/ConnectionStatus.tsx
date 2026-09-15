type ConnectionStatusProps = {
  online: boolean
  syncing?: boolean
  offlineLabel?: string
}

export function ConnectionStatus({ online, syncing = false, offlineLabel = 'Offline' }: ConnectionStatusProps) {
  const label = !online ? offlineLabel : syncing ? 'Connecting' : 'Online'
  const tone = !online ? 'bg-zinc-400 dark:bg-zinc-500' : syncing ? 'bg-blue-500' : 'bg-emerald-500'

  return <span className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400" role="status">
    <span className={`size-2 rounded-full ${tone}`} aria-hidden="true" />
    {label}
  </span>
}
