import type { ReactNode } from 'react'
import { SelectField } from '@aisley/ui'
import { FieldHelp } from './FieldHelp'
import { funding, type FormValues } from './model'
import type { Terms, Failure } from './types'

export function VoucherBenefitFields({
  role,
  values,
  identityLocked,
  busy,
  error,
  update,
  field,
}: {
  role: 'admin' | 'seller'
  values: FormValues
  identityLocked: boolean
  busy: boolean
  error: Failure | null
  update: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void
  field: (
    key: keyof FormValues,
    label: string,
    type?: string,
    extra?: Record<string, unknown>,
  ) => ReactNode
}) {
  return (
    <fieldset id="voucher-section-benefit" disabled={busy}>
      <legend>Benefit</legend>
      <div className="voucher-fields">
        <SelectField
          id="voucher-benefit_type"
          label="Benefit"
          value={values.benefit_type}
          disabled={identityLocked}
          error={error?.errors?.benefit_type?.[0]}
          onChange={(event) =>
            update('benefit_type', event.target.value as Terms['benefit_type'])
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
  )
}
