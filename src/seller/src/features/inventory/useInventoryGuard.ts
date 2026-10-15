import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export function useInventoryGuard(
  dirty: boolean,
  busy: boolean,
  uncertain: boolean,
) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || busy || uncertain) &&
      currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty && !busy && !uncertain) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy, uncertain])
  return blocker
}
