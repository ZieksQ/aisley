import { PortalModal } from '@aisley/ui/portal'
import { useId, useState, type FormEvent } from 'react'
import { FaArrowDownWideShort } from 'react-icons/fa6'
import { OrderButton } from './OrderUi'

export type OrderSortOption = { value: string; label: string; description: string }

export function OrderSortDialog({ value, options, onChange, buttonLabel = 'Sort', dialogTitle }: {
  value: string
  options: OrderSortOption[]
  onChange: (value: string) => void
  buttonLabel?: string
  dialogTitle?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const groupName = useId()
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onChange(draft)
    setOpen(false)
  }

  return (
    <>
      <OrderButton aria-haspopup="dialog" title={`Current order: ${selectedLabel}`}
        onClick={() => { setDraft(value); setOpen(true) }}>
        <FaArrowDownWideShort aria-hidden="true" />{buttonLabel}
      </OrderButton>
      {open && (
        <PortalModal title={dialogTitle ?? (buttonLabel === 'Sort' ? 'Sort orders' : buttonLabel)}
          description="Choose how these results are ordered." onClose={() => setOpen(false)}>
          <form onSubmit={apply}>
            <fieldset className="order-sort-options">
              <legend className="sr-only">Sort order</legend>
              {options.map((option) => (
                <label key={option.value}>
                  <input checked={draft === option.value} name={groupName}
                    onChange={() => setDraft(option.value)} type="radio" value={option.value} />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </label>
              ))}
            </fieldset>
            <div className="order-dialog-actions">
              <OrderButton onClick={() => setOpen(false)}>Cancel</OrderButton>
              <OrderButton variant="secondary" type="submit">Apply sort</OrderButton>
            </div>
          </form>
        </PortalModal>
      )}
    </>
  )
}
