import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

const inputClass = 'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-[#E6007A] focus:ring-2 focus:ring-pink-500/15 dark:border-white/15 dark:bg-[#111113] dark:text-white dark:placeholder:text-zinc-600'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export function FormField({ error, id, label, ...props }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>{label}</label>
      <input
        {...props}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        className={`${inputClass} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : ''}`}
        id={id}
      />
      {error ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
}

export function SelectField({ children, error, id, label, ...props }: SelectFieldProps) {
  const errorId = error ? `${id}-error` : undefined

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>{label}</label>
      <select
        {...props}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        className={`${inputClass} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : ''}`}
        id={id}
      >
        {children}
      </select>
      {error ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}
