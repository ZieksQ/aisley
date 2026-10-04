import { useState } from 'react'
import { TextField } from '@aisley/ui'
import { Button, date, Feedback, PaymentShell } from './common'
import { useFinanceRead, usePaymentAction, useUnsavedPaymentForm } from './hooks'
import type { PaymentProps, SettingsResponse } from './types'
export function SettingsView(props: PaymentProps) {
  const read = useFinanceRead<SettingsResponse>(props, '/automation')
  const [message, setMessage] = useState('')
  return <PaymentShell
    title={props.role === 'admin' ? 'Finance automation' : 'Payment settings'}
    description={props.role === 'admin' ? 'Set collection deadlines and separate payout schedules.' : 'View payment rules and your applicable schedules.'}>
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
  function toggle(field: keyof typeof enabled, text: string) {
    return <label className="payment-checkbox">
      <input
        type="checkbox"
        checked={enabled[field]}
        disabled={!canManage}
        onChange={(event) => setEnabled({ ...enabled, [field]: event.target.checked })} />
      {text}
    </label>
  }
  return <form
    onSubmit={(event) => {
      event.preventDefault()
      if (!window.confirm('Save these automation settings? Existing delivery deadlines and waiting periods will keep their recorded values.')) return
      void action.act('settings', save, 'Payment settings saved.')
    }}>
    {!current.gateway_enabled && <p className="payment-notice">Sandbox gateway is disabled. Automatic payments are paused.</p>}
    <Feedback error={action.error} />
    {admin ? <>
      <section className="payment-settings-group">
        <div>
          <h3>COD collection</h3>
          <p>Set the payment deadline after confirmed delivery. Logistics controls its own daily collection time.</p>
        </div>
        <fieldset>
          <legend className="payment-sr-only">COD collection rules</legend>
          <div className="payment-fields">
            <TextField
              id="cod-deadline"
              label="Payment deadline (days)"
              type="number"
              min="1"
              max="365"
              step="1"
              required
              disabled={!canManage}
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)} />
          </div>
          {toggle('collection_enabled', 'Collect outstanding COD automatically')}
        </fieldset>
      </section>
      <section className="payment-settings-group">
        <div>
          <h3>Seller payouts</h3>
          <p>The waiting period starts at delivery. Orders still need cleared COD and no financial holds.</p>
        </div>
        <fieldset>
          <legend className="payment-sr-only">Seller payout rules</legend>
          <div className="payment-fields">
            <TextField
              id="seller-delay"
              label="Waiting period (days)"
              type="number"
              min="1"
              max="365"
              step="1"
              required
              disabled={!canManage}
              value={sellerDays}
              onChange={(e) => setSellerDays(e.target.value)} />
            <TextField
              id="seller-run"
              label="Daily payout time"
              type="time"
              required
              disabled={!canManage}
              value={sellerTime}
              onChange={(e) => setSellerTime(e.target.value)} />
          </div>
          {toggle('seller_payout_enabled', 'Send eligible Seller payouts automatically')}
        </fieldset>
      </section>
      <section className="payment-settings-group">
        <div>
          <h3>Logistics payouts</h3>
          <p>Admin can send a manual early payout after COD is cleared and financial holds are released.</p>
        </div>
        <fieldset>
          <legend className="payment-sr-only">Logistics payout rules</legend>
          <div className="payment-fields">
            <TextField
              id="logistics-delay"
              label="Waiting period (hours)"
              type="number"
              min="1"
              max="8760"
              required
              disabled={!canManage}
              value={logisticsHours}
              onChange={(e) => setLogisticsHours(e.target.value)} />
            <TextField
              id="logistics-run"
              label="Daily payout time"
              type="time"
              required
              disabled={!canManage}
              value={logisticsTime}
              onChange={(e) => setLogisticsTime(e.target.value)} />
          </div>
          {toggle('logistics_payout_enabled', 'Send eligible Logistics payouts automatically')}
        </fieldset>
      </section>
    </> : <>
      {props.role === 'logistics' && <section className="payment-settings-group">
        <div>
          <h3>COD collection schedule</h3>
          <p>Collect outstanding invoices at this daily time. Use Pay now on the remittances page for an earlier payment.</p>
        </div>
        <div>
          <div className="payment-fields">
            <TextField
              id="collection-time"
              label="Daily COD payment time"
              type="time"
              required
              value={collectionTime}
              onChange={(e) => setCollectionTime(e.target.value)} />
          </div>
          <p className="payment-muted payment-next-run">Next collection: {date(current.next_collection_at)}</p>
        </div>
      </section>}
      <section className="payment-settings-group">
        <div>
          <h3>Platform payment rules</h3>
          <p>These rules are managed by Admin. Waiting periods start at confirmed delivery.</p>
        </div>
        <dl className="payment-details">
          <div>
            <dt>COD deadline</dt>
            <dd>{current.platform.cod_deadline_hours} hours after delivery</dd>
          </div>
          <div>
            <dt>Seller payout wait</dt>
            <dd>{current.platform.seller_delay_hours / 24} days after delivery</dd>
          </div>
          <div>
            <dt>Logistics payout wait</dt>
            <dd>{current.platform.logistics_delay_hours} hours after delivery</dd>
          </div>
          <div>
            <dt>Daily Seller payout</dt>
            <dd>{current.platform.seller_payout_time}</dd>
          </div>
          <div>
            <dt>Daily Logistics payout</dt>
            <dd>{current.platform.logistics_payout_time}</dd>
          </div>
        </dl>
      </section>
    </>}
    <div className="payment-form-footer">
      <p className="payment-muted">All schedules use Asia/Manila time. Deadlines and waiting periods apply to future deliveries; daily run times apply to future runs.</p>
      {canManage && <Button type="submit" isLoading={action.busy}>Save settings</Button>}
    </div>
  </form>
}
