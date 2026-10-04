import { useState } from 'react'
import { Button, TextField } from '@aisley/ui'
import { date, Feedback, PaymentShell } from './common'
import { useFinanceRead, usePaymentAction, useUnsavedPaymentForm } from './hooks'
import type { PaymentProps, SettingsResponse } from './types'

export function SettingsView(props: PaymentProps) {
  const read = useFinanceRead<SettingsResponse>(props, '/automation')
  const [message, setMessage] = useState('')
  return <PaymentShell title={props.role === 'admin' ? 'Finance automation' : 'Payment settings'}>
    <Feedback loading={read.loading} error={read.error} message={message} retry={read.reload} />
    {read.data && <SettingsForm
      key={JSON.stringify(read.data)}
      {...props}
      response={read.data}
      saved={() => { setMessage('Payment settings saved.'); read.reload() }} />}
  </PaymentShell>
}

function SettingsForm(props: PaymentProps & { response: SettingsResponse; saved: () => void }) {
  const current = props.response.data
  const [deadlineDays, setDeadlineDays] = useState(String(current.platform.cod_deadline_hours / 24))
  const [sellerDays, setSellerDays] = useState(String(current.platform.seller_delay_hours / 24))
  const [logisticsHours, setLogisticsHours] = useState(String(current.platform.logistics_delay_hours))
  const [collectionTime, setCollectionTime] = useState(current.collection?.collection_time ?? '09:00')
  const [sellerTime, setSellerTime] = useState(current.platform.seller_payout_time)
  const [logisticsTime, setLogisticsTime] = useState(current.platform.logistics_payout_time)
  const [enabled, setEnabled] = useState({ collection_enabled: current.platform.collection_enabled, seller_payout_enabled: current.platform.seller_payout_enabled, logistics_payout_enabled: current.platform.logistics_payout_enabled })
  const action = usePaymentAction()
  const canManage = current.can_manage
  const admin = props.role === 'admin'
  useUnsavedPaymentForm(canManage && (admin
    ? Number(deadlineDays) * 24 !== current.platform.cod_deadline_hours || Number(sellerDays) * 24 !== current.platform.seller_delay_hours || Number(logisticsHours) !== current.platform.logistics_delay_hours || sellerTime !== current.platform.seller_payout_time || logisticsTime !== current.platform.logistics_payout_time || Object.keys(enabled).some((field) => enabled[field as keyof typeof enabled] !== current.platform[field as keyof typeof enabled])
    : collectionTime !== (current.collection?.collection_time ?? '09:00')))
  async function save() {
    const body = admin ? { cod_deadline_hours: Number(deadlineDays) * 24, seller_delay_hours: Number(sellerDays) * 24, logistics_delay_hours: Number(logisticsHours), seller_payout_time: sellerTime, logistics_payout_time: logisticsTime, ...enabled } : { collection_time: collectionTime }
    await props.request(`${props.prefix}/automation`, { method: 'PATCH', body: JSON.stringify(body) })
    props.saved()
  }
  return <form onSubmit={(event) => { event.preventDefault(); if (!window.confirm('Save these automation settings? Existing delivery deadlines and waiting periods will keep their recorded values.')) return; void action.act('settings', save, 'Payment settings saved.') }}>

    <p>
      All schedules use Asia/Manila time. Deadlines and waiting periods apply to future deliveries; daily run times apply to future runs.
    </p>

    {!current.gateway_enabled && <p>
      Sandbox gateway is disabled. Automatic payments are paused.
    </p>}

    <Feedback error={action.error} message={action.message} />

    {admin ? <><div className="payment-fields">

      <TextField
        id="cod-deadline"
        label="COD payment deadline (days)"
        type="number"
        min="1"
        max="365"
        step="1"
        required
        disabled={!canManage}
        value={deadlineDays}
        onChange={(e) => setDeadlineDays(e.target.value)} />

      <TextField
        id="seller-delay"
        label="Seller payout wait (days after delivery)"
        type="number"
        min="1"
        max="365"
        step="1"
        required
        disabled={!canManage}
        value={sellerDays}
        onChange={(e) => setSellerDays(e.target.value)} />

      <TextField
        id="logistics-delay"
        label="Logistics payout wait (hours after delivery)"
        type="number"
        min="1"
        max="8760"
        required
        disabled={!canManage}
        value={logisticsHours}
        onChange={(e) => setLogisticsHours(e.target.value)} />

      <TextField
        id="seller-run"
        label="Daily Seller payout time"
        type="time"
        required
        disabled={!canManage}
        value={sellerTime}
        onChange={(e) => setSellerTime(e.target.value)} />

      <TextField
        id="logistics-run"
        label="Daily Logistics payout time"
        type="time"
        required
        disabled={!canManage}
        value={logisticsTime}
        onChange={(e) => setLogisticsTime(e.target.value)} />

    </div><div className="payment-toolbar">
        {(['collection_enabled', 'seller_payout_enabled', 'logistics_payout_enabled'] as const).map((field) => <label key={field}>
          <input
            type="checkbox"
            checked={enabled[field]}
            disabled={!canManage}
            onChange={(e) => setEnabled({ ...enabled, [field]: e.target.checked })} />
          {field === 'collection_enabled' ? 'Automatic COD collection' : field === 'seller_payout_enabled' ? 'Automatic Seller payouts' : 'Automatic Logistics payouts'}
        </label>)}
      </div></> : <>
      <dl className="payment-details">
        <dt>
          COD deadline
        </dt>
        <dd>
          {current.platform.cod_deadline_hours}
          hours after delivery
        </dd>
        <dt>
          Seller payout wait
        </dt>
        <dd>
          {current.platform.seller_delay_hours / 24}
          days after delivery
        </dd>
        <dt>
          Logistics payout wait
        </dt>
        <dd>
          {current.platform.logistics_delay_hours}
          hours after delivery
        </dd>
        <dt>
          Daily Seller payout
        </dt>
        <dd>
          {current.platform.seller_payout_time}
        </dd>
        <dt>
          Daily Logistics payout
        </dt>
        <dd>
          {current.platform.logistics_payout_time}
        </dd>
      </dl>
      {props.role === 'logistics' && <><h3>
        COD collection schedule
      </h3><p>
          Collect all outstanding invoices at this daily time. You can also pay invoices manually.
        </p><div className="payment-fields">
          <TextField
            id="collection-time"
            label="Daily COD payment time"
            type="time"
            required
            value={collectionTime}
            onChange={(e) => setCollectionTime(e.target.value)} />
        </div><p>
          Next collection:
          {date(current.next_collection_at)}
        </p></>}
    </>}

    {canManage && <div className="payment-toolbar">
      <Button type="submit" isLoading={action.busy}>
        Save settings
      </Button>
    </div>}

  </form>
}
