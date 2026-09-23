import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CampaignInput } from '../../lib/notificationCampaigns'

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-[#4C1268] focus:outline-none focus:ring-2 focus:ring-[#4C1268]/20 dark:border-white/15 dark:bg-[#221b29] dark:text-white'

export function CampaignForm({ initial, busy, onSave, buttonLabel }: {
  initial: CampaignInput
  busy: boolean
  onSave: (input: CampaignInput) => Promise<void>
  buttonLabel: string
}) {
  const [input, setInput] = useState<CampaignInput>(initial)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSave(input)
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">
        Title
        <input className={inputClass} maxLength={120} minLength={3} onChange={(event) => setInput({ ...input, title: event.target.value })} required value={input.title} />
      </label>
      <label className="block text-sm font-medium">
        Message (plain text)
        <textarea className={`${inputClass} min-h-28`} maxLength={2000} minLength={3} onChange={(event) => setInput({ ...input, body: event.target.value })} required value={input.body} />
      </label>
      <label className="block text-sm font-medium">
        Audience
        <select className={inputClass} disabled value="opted_in_customers">
          <option value="opted_in_customers">Customers opted in to in-app promotions</option>
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Optional destination
          <select className={inputClass} onChange={(event) => setInput({ ...input, destination_type: event.target.value as CampaignInput['destination_type'] || null, destination_id: null })} value={input.destination_type ?? ''}>
            <option value="">No destination</option>
            <option value="product">Visible Product</option>
            <option value="shop">Visible Shop</option>
          </select>
        </label>
        {input.destination_type && (
          <label className="block text-sm font-medium">
            {input.destination_type === 'product' ? 'Product' : 'Shop'} ID
            <input className={inputClass} onChange={(event) => setInput({ ...input, destination_id: event.target.value })} required value={input.destination_id ?? ''} />
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Only active, opted-in Customers can receive this in-app message. No browser push or SMS is sent.</p>
      <button className="rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white hover:bg-[#39104e] disabled:opacity-50" disabled={busy} type="submit">
        {busy ? 'Saving…' : buttonLabel}
      </button>
    </form>
  )
}
