import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import { ConfirmationDialog } from '@aisley/ui/portal'

export function CampaignNavigationGuard({ dirty, busy, uncertain }: { dirty: boolean; busy: boolean; uncertain: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (dirty || busy || uncertain) && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty && !busy && !uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy, uncertain])
  if (blocker.state !== 'blocked') return null
  return <ConfirmationDialog
    title={busy || uncertain ? 'Campaign request in progress' : 'Discard unsaved changes?'}
    confirmLabel="Discard changes" confirmDisabled={busy || uncertain} destructive
    onClose={() => blocker.reset()} onConfirm={() => blocker.proceed()}>
    <p>{busy ? 'Wait for the current request to finish before leaving.' : uncertain
      ? 'Close this dialog and check the campaign status before leaving. The send outcome is not yet known.'
      : 'Your unsaved message changes will be lost. Saved drafts remain in campaign history.'}</p>
  </ConfirmationDialog>
}
