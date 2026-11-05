import { useId } from 'react'
import { PortalField } from '@aisley/ui/portal'
import type { CampaignInput } from '../../lib/notificationCampaigns'

export function CampaignForm({ input, busy, dirty, errors, onChange, onSave, isNew }: {
  input: CampaignInput
  busy: boolean
  dirty: boolean
  errors: Record<string, string[]>
  onChange: (input: CampaignInput) => void
  onSave: () => void
  isNew: boolean
}) {
  const id = useId()
  return <form className="portal-panel campaign-form" aria-label="Campaign draft" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <div className="campaign-section-heading">
      <h3>Message</h3>
      <span className="portal-secondary">{dirty ? 'Unsaved changes' : isNew ? 'New draft' : 'Saved draft'}</span>
    </div>
    <fieldset disabled={busy}>
      <PortalField label="Title" required minLength={3} maxLength={120} value={input.title}
        hint={`${input.title.length} / 120 characters`} error={errors.title?.[0]}
        onChange={(event) => onChange({ ...input, title: event.target.value })} />
      <div className="portal-field">
        <label htmlFor={`${id}-body`}>Message <span className="portal-required" aria-hidden="true">*</span>
        </label>
        <textarea id={`${id}-body`} required minLength={3} maxLength={2000} rows={6} value={input.body}
          aria-invalid={Boolean(errors.body)} aria-describedby={`${id}-body-help`}
          onChange={(event) => onChange({ ...input, body: event.target.value })} />
        <p id={`${id}-body-help`} className={errors.body ? 'portal-field-error' : 'portal-field-hint'}>
          {errors.body?.[0] ?? `${input.body.length} / 2,000 characters · Plain text only`}
        </p>
      </div>
      <div className="campaign-audience">
        <h4>Audience</h4>
        <p>Customers opted in to in-app promotions</p>
        <p className="portal-secondary">Only active, opted-in Customers are eligible. Browser push and SMS are not sent.</p>
        {errors.audience_key && <p className="portal-field-error" role="alert">{errors.audience_key[0]}</p>}
      </div>
      <div className="campaign-destination-fields">
        <div className="portal-field">
          <label htmlFor={`${id}-destination`}>Optional destination</label>
          <select id={`${id}-destination`} value={input.destination_type ?? ''}
            aria-invalid={Boolean(errors.destination_type)} aria-describedby={errors.destination_type ? `${id}-destination-error` : undefined}
            onChange={(event) => onChange({ ...input, destination_type: event.target.value as CampaignInput['destination_type'] || null, destination_id: null })}>
            <option value="">No destination</option>
            <option value="product">Product</option>
            <option value="shop">Shop</option>
          </select>
          {errors.destination_type && <p className="portal-field-error" id={`${id}-destination-error`}>{errors.destination_type[0]}</p>}
        </div>
        {input.destination_type && <PortalField label={`${input.destination_type === 'product' ? 'Product' : 'Shop'} ID`}
          required value={input.destination_id ?? ''} error={errors.destination_id?.[0]} hint="Must identify a visible resource."
          onChange={(event) => onChange({ ...input, destination_id: event.target.value })} />}
      </div>
      <div className="campaign-form-footer">
        <p className="portal-secondary">Save, review your audience, then confirm the send.</p>
        <button className="portal-button portal-button-primary" type="submit" disabled={busy || (!isNew && !dirty)} aria-busy={busy}>
          {busy ? 'Please wait…' : isNew ? 'Create draft' : 'Save draft'}
        </button>
      </div>
    </fieldset>
  </form>
}
