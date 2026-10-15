import { useRef, useState, type FormEvent } from 'react'
import { FaArrowDownWideShort } from 'react-icons/fa6'
import { OrderButton } from './OrderUi'

export type OrderSortOption = { value: string; label: string; description: string }

export function OrderSortDialog({ value, options, onChange, buttonLabel = 'Sort' }: {
  value: string
  options: OrderSortOption[]
  onChange: (value: string) => void
  buttonLabel?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(value)
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? 'Default'
  const dialogTitle = buttonLabel === 'Sort' ? 'Sort orders' : buttonLabel

  function open() {
    setDraft(value)
    dialog.current?.showModal()
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onChange(draft)
    dialog.current?.close()
  }

  return <>
    <OrderButton aria-haspopup="dialog" onClick={open}>
      <FaArrowDownWideShort aria-hidden="true" />
      <span>{buttonLabel}: {selectedLabel}</span>
    </OrderButton>
    <dialog ref={dialog} aria-labelledby="order-sort-title" aria-describedby="order-sort-description" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-xl backdrop:bg-black/50 dark:border-white/15 dark:bg-[#18181b] dark:text-zinc-100">
      <form onSubmit={apply}>
        <div className="border-b border-zinc-200 p-5 dark:border-white/10">
          <h2 className="text-lg font-semibold" id="order-sort-title">{dialogTitle}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" id="order-sort-description">Choose how these results are ordered.</p>
        </div>
        <fieldset className="space-y-1 p-4">
          <legend className="sr-only">Sort order</legend>
          {options.map((option) => <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${draft === option.value ? 'border-[#4C1268] bg-[#F1EAF4] dark:border-purple-300 dark:bg-purple-300/10' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-white/5'}`} key={option.value}>
            <input checked={draft === option.value} className="mt-1 size-4 accent-[#4C1268]" name="order-sort" onChange={() => setDraft(option.value)} type="radio" value={option.value} />
            <span><span className="block text-sm font-medium">{option.label}</span><span className="mt-1 block text-xs leading-5 text-zinc-600 dark:text-zinc-400">{option.description}</span></span>
          </label>)}
        </fieldset>
        <div className="flex justify-end gap-3 border-t border-zinc-200 p-4 dark:border-white/10">
          <OrderButton onClick={() => dialog.current?.close()} type="button">Cancel</OrderButton>
          <OrderButton variant="secondary" type="submit">Apply sort</OrderButton>
        </div>
      </form>
    </dialog>
  </>
}
