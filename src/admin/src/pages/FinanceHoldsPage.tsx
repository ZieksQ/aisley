import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FinanceHoldDetail } from '../components/finance-holds/FinanceHoldDetail'
import { FinanceHoldQueue } from '../components/finance-holds/FinanceHoldQueue'

export function FinanceHoldsPage() {
  const { admin } = useAuth()
  const { holdId } = useParams()
  const canManage = admin?.permissions.includes('finance.manage') ?? false

  useEffect(() => { document.title = `${holdId ? 'Finance hold review' : 'Finance holds'} | Aisley Admin` }, [holdId])

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="border-b border-slate-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">Finance holds</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Review unplanned routes and evidence gaps, then assign the frozen Logistics pool to the carriers that completed each service.</p>
      </div>
      {holdId ? <FinanceHoldDetail canManage={canManage} holdId={holdId} /> : <FinanceHoldQueue />}
    </div>
  )
}
