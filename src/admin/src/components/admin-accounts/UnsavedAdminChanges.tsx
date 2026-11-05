import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmationDialog } from '@aisley/ui/portal'

export function UnsavedAdminChanges({ dirty }: { dirty: boolean }) {
  const navigate = useNavigate()
  const [destination, setDestination] = useState<string | null>(null)
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return
      const anchor = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target || anchor.download || anchor.origin !== window.location.origin)
        return
      const target = `${anchor.pathname}${anchor.search}${anchor.hash}`
      if (target === `${window.location.pathname}${window.location.search}${window.location.hash}`)
        return
      event.preventDefault()
      event.stopPropagation()
      setDestination(target)
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
    }
  }, [dirty])
  return destination ? (
    <ConfirmationDialog
      title="Discard unsaved changes?"
      confirmLabel="Discard changes"
      destructive
      onClose={() => setDestination(null)}
      onConfirm={() => {
        const target = destination
        setDestination(null)
        navigate(target)
      }}
    >
      <p>Your unsaved account or role changes will be lost.</p>
    </ConfirmationDialog>
  ) : null
}
