import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice, link } from '../components/PickupUi'
import { billingAccount, type Billing } from '../features/logisticsFinance/api'

export function BillingPage() {
  const [account, setAccount] = useState<Billing | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setAccount(null)
    setError('')
    void billingAccount(controller.signal).then((result) => setAccount(result.data)).catch((caught: unknown) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Could not load Billing.')
    })
    return () => controller.abort()
  }, [version])
  return <>
    <section className="max-w-5xl p-5 sm:p-7">
      <header className="border-b border-zinc-200 pb-4 dark:border-white/10">
        <h2 className="text-xl font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Payment method for COD remittances and Logistics payouts.</p>
      </header>
      {error && <div className="mt-5">
        <ErrorNotice message={error} retry={() => setVersion((value) => value + 1)} />
      </div>}
      {!account && !error && <p className="py-8 text-sm" role="status">Loading payment method…</p>}
      {account && <section className="max-w-2xl py-6" aria-label="Current payment method">
        <h3 className="font-semibold">
          {account.label}
        </h3>
        <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Account</dt>
            <dd className="mt-1 font-medium">
              {account.masked_identifier}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Currency</dt>
            <dd className="mt-1">
              {account.currency}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="mt-1">
              {account.active ? 'Active' : 'Inactive'}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">This is a simulated payment account. No real money moves. Cash received from Couriers funds the account for platform COD payments.</p>
        {!account.simulation_enabled && <p role="status" className="mt-4 text-sm text-amber-800 dark:text-amber-300">Payment simulation is currently disabled. Recorded cash receipts keep their pending simulated credits.</p>}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link className={link} to="/finance/courier-cash">Courier cash remittance</Link>
          <Link className={link} to="/finance/payment-settings">Payment settings</Link>
        </div>
      </section>}
    </section>
  </>
}
