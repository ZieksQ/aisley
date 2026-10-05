import { useEffect, useState } from 'react'
import { ApiError } from '../../lib/api'
import { cashBalances, cashReceipts, receiveCash, type CashAttempt, type CashPage, type ReceiptPage } from './api'

export function useCourierCash() {
  const [view, setView] = useState<'outstanding' | 'history'>('outstanding')
  const [courier, setCourier] = useState('')
  const [currency, setCurrency] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CashPage | null>(null)
  const [history, setHistory] = useState<ReceiptPage | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState<CashAttempt | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const load = async () => {
      try {
        if (view === 'outstanding') {
          const result = await cashBalances(page, courier, currency, controller.signal)
          if (!controller.signal.aborted) setData(result)
        } else {
          const result = await cashReceipts(page, controller.signal)
          if (!controller.signal.aborted) setHistory(result)
        }
      } catch (caught) {
        if (controller.signal.aborted) return
        if (caught instanceof ApiError && [401, 403].includes(caught.status)) {
          setData(null);
          setHistory(null);
          setSelected([]);
          setAttempt(null)
        }
        setError(caught instanceof Error ? caught.message : 'Could not load Courier cash.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [view, page, courier, currency, version])

  async function receive() {
    if (busy || (!attempt && selected.length === 0)) return
    const next = attempt ?? {
      obligation_ids: selected,
      confirmed: true as const,
      idempotency_key: crypto.randomUUID(),
      selection: data?.data.filter((row) => selected.includes(row.id)) ?? []
    }
    if (!attempt && !window.confirm('Confirm you received the full cash amount for these Orders from the Courier?')) return
    setAttempt(next)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await receiveCash(next)
      setAttempt(null)
      setSelected([])
      setNotice(`Cash receipt recorded. ${result.data.simulation_credit === 'credited' ? 'The simulated payment account was credited.' : 'The simulated account credit is pending.'}`)
      setVersion((value) => value + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
        setAttempt(null)
        setSelected([])
        if ([401, 403].includes(caught.status)) {
          setData(null);
          setHistory(null)
        }
      }
      setError(caught instanceof Error ? caught.message : 'The result is uncertain. Retry the same receipt.')
    } finally {
      setBusy(false)
    }
  }

  return {
    view,
    changeView: (next: typeof view) => {
      setSelected([]);
      setPage(1);
      setView(next)
    },
    courier,
    currency,
    filter: (id: string, code: string) => {
      setSelected([]);
      setCourier(id);
      setCurrency(code);
      setPage(1)
    },
    page,
    changePage: (value: number) => {
      setSelected([]);
      setPage(value)
    },
    data,
    history,
    selected,
    setSelected,
    loading,
    busy,
    attempt,
    error,
    notice,
    reload: () => setVersion((value) => value + 1),
    receive,
    locked: busy || attempt !== null
  }
}
