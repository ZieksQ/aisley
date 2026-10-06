import { useEffect } from 'react'
import { FaXmark } from 'react-icons/fa6'

export function TimedNotice({ message, onChange }: { message: string; onChange: (message: string) => void }) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => onChange(''), 5000)
    return () => window.clearTimeout(timer)
  }, [message, onChange])

  if (!message) return null
  return (
    <div role="status" className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">

      <p className="min-w-0 flex-1 break-words">
        {message}
      </p>

      <button type="button" aria-label="Dismiss message" className="grid size-7 shrink-0 place-items-center rounded hover:bg-black/5 focus-visible:outline-2 dark:hover:bg-white/10" onClick={() => onChange('')}>

        <FaXmark aria-hidden="true" />

      </button>

    </div>
  )
}
