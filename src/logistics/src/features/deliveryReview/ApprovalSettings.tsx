import { useEffect, useState } from 'react'
import { Button } from '@aisley/ui'
import { ErrorNotice } from '../../components/PickupUi'
import { loadApprovalSettings, saveApprovalSettings } from './api'
import { workflowButton } from '../logisticsFinance/presentation'

export function ApprovalSettings() {
  const [mode, setMode] = useState<'manual' | 'automatic'>('manual')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoaded(false)
    setError('')
    void loadApprovalSettings(controller.signal).then((result) => {
      setMode(result.data.mode);
      setLoaded(true)
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Could not load settings.')
    })
    return () => controller.abort()
  }, [version])
  async function save() {
    if (!window.confirm('Save this approval policy for future completion requests? COD will continue to require manual review.')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await saveApprovalSettings(mode);
      setNotice('Approval settings saved.')
    }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save settings.')
    }
    finally {
      setBusy(false)
    }
  }
  return <section className="max-w-2xl space-y-4 py-5" aria-label="Approval settings">
    {error && <ErrorNotice message={error} retry={() => setVersion((value) => value + 1)} />}
    {!loaded && !error && <p role="status">Loading approval settings…</p>}
    {loaded && <>
      <h3 className="font-semibold">Prepaid deliveries</h3>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[#4C1268]"
          checked={mode === 'automatic'}
          disabled={busy}
          onChange={(event) => setMode(event.target.checked ? 'automatic' : 'manual')}
        />
        <span>Automatically approve prepaid deliveries<span className="mt-1 block text-zinc-600 dark:text-zinc-400">A valid stored photo and Courier completion request are required. Photos are accepted without a visual quality review.</span></span>
      </label>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">COD deliveries always require manual approval. Changes apply to new completion requests; existing pending reviews stay in the queue.</p>
      <Button variant="secondary" className={workflowButton} isLoading={busy} onClick={() => void save()}>Save settings</Button>
    </>}
    {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
      {notice}
    </p>}
  </section>
}
