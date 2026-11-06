import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function BillingPage() {
  useEffect(() => { document.title = 'Billing | AISLEY Admin' }, [])
  return <section className="max-w-3xl p-5 sm:p-7">
    <header className="border-b border-zinc-200 pb-5 dark:border-white/10">
      <h2 className="text-xl font-semibold">Billing</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review collection deadlines and payout schedules in Finance.</p>
    </header>
    <div className="py-6">
      <h3 className="text-sm font-semibold">Payment settings</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Finance permissions determine whether you can view or change these settings.</p>
      <Link className="portal-button mt-4 inline-flex" to="/finance/automation">Open payment settings</Link>
    </div>
  </section>
}
