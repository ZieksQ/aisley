import { useEffect, useState } from 'react'
import { Button, TextField, SelectField } from '@aisley/ui'
import { formValues, payload, type FormValues } from './model'
import type { Terms, Failure } from './types'
import { FieldHelp } from './FieldHelp'
import { Confirmation } from './Confirmation'
import { VoucherBenefitFields } from './VoucherBenefitFields'

export function VoucherEditor({
  initial,
  role,
  revision,
  identityLocked,
  busy,
  uncertain,
  error,
  onSubmit,
  onCancel,
  onDirtyChange,
}: {
  initial?: Terms
  role: 'admin' | 'seller'
  revision: number
  identityLocked: boolean
  busy: boolean
  uncertain: boolean
  error: Failure | null
  onSubmit: (body: Record<string, unknown>) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [baseline] = useState(() => formValues(initial))
  const [values, setValues] = useState<FormValues>(baseline)
  const [discard, setDiscard] = useState(false)
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }
  function field(
    key: keyof FormValues,
    label: string,
    type = 'text',
    extra: Record<string, unknown> = {},
  ) {
    return (
      <TextField
        id={`voucher-${key}`}
        label={label}
        type={type}
        value={String(values[key])}
        error={error?.errors?.[key]?.[0]}
        onChange={(event) => update(key, event.target.value as never)}
        {...extra}
      />
    )
  }
  function cancel() {
    if (dirty) setDiscard(true)
    else onCancel()
  }
  return (
    <>
      <form
        className="voucher-editor"
        onSubmit={(event) => {
          event.preventDefault()
          const body = payload(values, revision, initial)
          if (role === 'seller') delete body.distribution_mode
          onSubmit(body)
        }}
      >
        <nav className="voucher-editor-nav" aria-label="Voucher sections">
          {[
            'Details',
            'Benefit',
            'Conditions',
            'Schedule',
            'Limits',
            'Terms',
          ].map((section) => (
            <a key={section} href={`#voucher-section-${section.toLowerCase()}`}>
              {section}
            </a>
          ))}
        </nav>
        <div className="voucher-editor-fields">
          <fieldset id="voucher-section-details" disabled={busy || uncertain}>
            <legend>Voucher details</legend>
            <div className="voucher-fields">
              {field('name', 'Voucher name', 'text', {
                required: true,
                maxLength: 120,
                placeholder: 'e.g. Payday savings',
                hint: 'Customers see this name when choosing a voucher at checkout.',
              })}
              {role === 'admin' && (
                <SelectField
                  id="voucher-distribution_mode"
                  label="Distribution"
                  value={values.distribution_mode}
                  disabled={identityLocked}
                  error={error?.errors?.distribution_mode?.[0]}
                  onChange={(event) =>
                    update(
                      'distribution_mode',
                      event.target.value as FormValues['distribution_mode'],
                    )
                  }
                >
                  <option value="claim_required">Claim required</option>
                  <option value="automatic">Automatically available</option>
                </SelectField>
              )}
              {field('code', 'Code', 'text', {
                maxLength: 64,
                disabled: identityLocked,
                placeholder: 'Generated when left blank',
                hint: 'Uppercase letters, digits and hyphens. Fixed after publication.',
              })}
            </div>
            {role === 'admin' && (
              <p className="mt-4">
                Distribution is fixed after publication. Duplicate to change it.
              </p>
            )}
          </fieldset>
          <VoucherBenefitFields
            role={role}
            values={values}
            identityLocked={identityLocked}
            busy={busy || uncertain}
            error={error}
            update={update}
            field={field}
          />
          <fieldset
            id="voucher-section-conditions"
            disabled={busy || uncertain}
          >
            <legend>Conditions</legend>
            <div className="voucher-fields">
              {field(
                'minimum_spend',
                'Minimum Shop merchandise spend (PHP)',
                'number',
                { required: true, min: '0', step: '0.01' },
              )}
              {field(
                'maximum_discount',
                'Savings cap (PHP, optional)',
                'number',
                {
                  min: '0.01',
                  step: '0.01',
                  max: '9999999999.99',
                  hint: 'Leave blank for no additional cap.',
                  labelHelp: (
                    <FieldHelp label="Savings cap">
                      The most this voucher can save per Shop order, in PHP. For
                      example, 20% off a ₱1,000 eligible amount with a ₱100 cap
                      saves ₱100. This also limits fixed savings.
                    </FieldHelp>
                  ),
                },
              )}
            </div>
            <p className="mt-4">All eligible items · PHP · Cash on delivery</p>
          </fieldset>
          <fieldset id="voucher-section-schedule" disabled={busy || uncertain}>
            <legend>Schedule (Asia/Manila)</legend>
            <div className="voucher-fields">
              {field('starts_at', 'Starts', 'datetime-local', {
                required: true,
              })}
              {field('ends_at', 'Ends', 'datetime-local', {
                required: true,
                min: values.starts_at,
              })}
            </div>
            {identityLocked && (
              <p className="mt-4">
                Replacement takes effect immediately. Its start must already
                have arrived. Duplicate to schedule an independent future offer.
              </p>
            )}
          </fieldset>
          <fieldset id="voucher-section-limits" disabled={busy || uncertain}>
            <legend>Redemption limits</legend>
            <div className="voucher-fields">
              {field('global_limit', 'Total redemptions (optional)', 'number', {
                min: 1,
                step: 1,
                max: 2147483647,
                hint: 'Leave blank for unlimited. Includes previous usage.',
              })}
              {field(
                'per_customer_limit',
                'Redemptions per Customer',
                'number',
                {
                  required: true,
                  min: 1,
                  step: 1,
                  max: 2147483647,
                },
              )}
            </div>
          </fieldset>
          <fieldset id="voucher-section-terms" disabled={busy || uncertain}>
            <legend>Terms</legend>
            <label htmlFor="voucher-terms_summary">Plain-text terms</label>
            <textarea
              id="voucher-terms_summary"
              required
              maxLength={5000}
              value={values.terms_summary}
              aria-invalid={Boolean(error?.errors?.terms_summary)}
              aria-describedby={
                error?.errors?.terms_summary ? 'voucher-terms-error' : undefined
              }
              onChange={(event) => update('terms_summary', event.target.value)}
            />
            {error?.errors?.terms_summary && (
              <p role="alert" id="voucher-terms-error">
                {error.errors.terms_summary[0]}
              </p>
            )}
          </fieldset>
          <div className="voucher-actions voucher-editor-save">
            <Button type="submit" isLoading={busy} disabled={uncertain}>
              Save draft
            </Button>
            <Button
              variant="outline"
              disabled={busy || uncertain}
              onClick={cancel}
            >
              Cancel
            </Button>
            {dirty && <span>Unsaved changes</span>}
          </div>
        </div>
      </form>
      {discard && (
        <Confirmation
          title="Discard unsaved voucher input?"
          confirm="Discard input"
          onCancel={() => setDiscard(false)}
          onConfirm={onCancel}
        >
          <p>Your unsaved voucher terms will be discarded.</p>
        </Confirmation>
      )}
    </>
  )
}
