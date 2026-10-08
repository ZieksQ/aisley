import { useEffect, useState } from 'react'
import { Button, TextField, SelectField } from '@aisley/ui'
import { formValues, funding, payload, type FormValues } from './model'
import type { Terms, Failure } from './types'
import { FieldHelp } from './FieldHelp'

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
    if (!dirty || window.confirm('Discard unsaved voucher input?')) onCancel()
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(payload(values, revision, initial))
      }}
    >
      <fieldset disabled={busy || uncertain}>
        <legend>Voucher details</legend>
        <div className="voucher-fields">
          {field('name', 'Voucher name', 'text', {
            required: true,
            maxLength: 120,
            placeholder: 'e.g. Payday savings',
            hint: 'Customers see this name when choosing a voucher at checkout.',
          })}
          {field('code', 'Code', 'text', {
            maxLength: 64,
            disabled: identityLocked,
            placeholder: 'Generated when left blank',
            hint: 'Uppercase letters, digits and hyphens. Fixed after publication.',
          })}
        </div>
      </fieldset>
      <fieldset disabled={busy || uncertain}>
        <legend>Benefit</legend>
        <div className="voucher-fields">
          <SelectField
            id="voucher-benefit_type"
            label="Benefit"
            value={values.benefit_type}
            disabled={identityLocked}
            error={error?.errors?.benefit_type?.[0]}
            onChange={(event) =>
              update(
                'benefit_type',
                event.target.value as Terms['benefit_type'],
              )
            }
          >
            <option value="discount">Merchandise discount</option>
            {role === 'admin' && (
              <option value="shipping">Shipping saving</option>
            )}
          </SelectField>
          <SelectField
            id="voucher-value_type"
            label="Saving type"
            value={values.value_type}
            onChange={(event) =>
              update('value_type', event.target.value as Terms['value_type'])
            }
          >
            <option value="fixed">Fixed PHP amount</option>
            <option value="percent">Percentage</option>
          </SelectField>
          {field(
            'value',
            values.value_type === 'percent' ? 'Percentage' : 'Saving (PHP)',
            'number',
            {
              labelHelp: (
                <FieldHelp
                  label={
                    values.value_type === 'percent'
                      ? 'Percentage'
                      : 'Saving (PHP)'
                  }
                >
                  {values.value_type === 'percent'
                    ? 'The percentage taken off eligible merchandise or the shipping fee. A savings cap limits the final amount.'
                    : 'The PHP amount taken off eligible merchandise or the shipping fee. Savings never exceed that amount or the savings cap.'}
                </FieldHelp>
              ),
              required: true,
              min: '0.01',
              step: '0.01',
              max: values.value_type === 'percent' ? 100 : '9999999999.99',
            },
          )}
        </div>
        <p className="mt-4">{funding(role)}</p>
      </fieldset>
      <fieldset disabled={busy || uncertain}>
        <legend>Conditions</legend>
        <div className="voucher-fields">
          {field(
            'minimum_spend',
            'Minimum Shop merchandise spend (PHP)',
            'number',
            { required: true, min: '0', step: '0.01' },
          )}
          {field('maximum_discount', 'Savings cap (PHP, optional)', 'number', {
            min: '0.01',
            step: '0.01',
            max: '9999999999.99',
            hint: 'Leave blank for no additional cap.',
            labelHelp: (
              <FieldHelp label="Savings cap">
                The most this voucher can save per Shop order, in PHP. For
                example, 20% off a ₱1,000 eligible amount with a ₱100 cap saves
                ₱100. This also limits fixed savings.
              </FieldHelp>
            ),
          })}
        </div>
        <p className="mt-4">All eligible items · PHP · Cash on delivery</p>
      </fieldset>
      <fieldset disabled={busy || uncertain}>
        <legend>Schedule (Asia/Manila)</legend>
        <div className="voucher-fields">
          {field('starts_at', 'Starts', 'datetime-local', { required: true })}
          {field('ends_at', 'Ends', 'datetime-local', {
            required: true,
            min: values.starts_at,
          })}
        </div>
        {identityLocked && (
          <p className="mt-4">
            Replacement takes effect immediately. Its start must already have
            arrived. Duplicate to schedule an independent future offer.
          </p>
        )}
      </fieldset>
      <fieldset disabled={busy || uncertain}>
        <legend>Redemption limits</legend>
        <div className="voucher-fields">
          {field('global_limit', 'Total redemptions (optional)', 'number', {
            min: 1,
            step: 1,
            max: 2147483647,
            hint: 'Leave blank for unlimited. Includes previous usage.',
          })}
          {field('per_customer_limit', 'Redemptions per Customer', 'number', {
            required: true,
            min: 1,
            step: 1,
            max: 2147483647,
          })}
        </div>
      </fieldset>
      <fieldset disabled={busy || uncertain}>
        <legend>Terms</legend>
        <label htmlFor="voucher-terms_summary">Plain-text terms</label>
        <textarea
          id="voucher-terms_summary"
          required
          maxLength={5000}
          value={values.terms_summary}
          aria-invalid={Boolean(error?.errors?.terms_summary)}
          onChange={(event) => update('terms_summary', event.target.value)}
        />
        {error?.errors?.terms_summary && (
          <p role="alert">{error.errors.terms_summary[0]}</p>
        )}
      </fieldset>
      <div className="voucher-actions">
        <Button type="submit" isLoading={busy} disabled={uncertain}>
          Save draft
        </Button>
        <Button variant="outline" disabled={busy || uncertain} onClick={cancel}>
          Cancel
        </Button>
        {dirty && <span>Unsaved changes</span>}
      </div>
    </form>
  )
}
