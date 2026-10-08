import { useEffect } from 'react'
import type { GuardState } from './types'

export function useUnsaved(
  state: GuardState,
  onGuardChange: (state: GuardState) => void,
) {
  const { dirty, busy, uncertain } = state
  useEffect(() => {
    onGuardChange({ dirty, busy, uncertain })
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    if (dirty || busy || uncertain)
      window.addEventListener('beforeunload', unload)
    return () => {
      window.removeEventListener('beforeunload', unload)
      onGuardChange({ dirty: false, busy: false, uncertain: false })
    }
  }, [dirty, busy, uncertain, onGuardChange])
}
