import flatpickr from 'flatpickr'
import type { Instance } from 'flatpickr/dist/types/instance'
import type { Options } from 'flatpickr/dist/types/options'
import { useEffect, useRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { inputStyles } from './Field'

type FlatpickrOptions = Omit<Options, 'onChange'>

export type FlatpickrInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange' | 'type' | 'value'> & {
  value?: string
  onChange: (value: string) => void
  options?: FlatpickrOptions
}

export function FlatpickrInput({ className = '', onChange, options, value = '', ...props }: FlatpickrInputProps) {
  const input = useRef<HTMLInputElement>(null)
  const instance = useRef<Instance | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    if (!input.current) return
    const picker = flatpickr(input.current, {
      animate: false,
      disableMobile: true,
      ...options,
      defaultDate: value || options?.defaultDate,
      onChange: (_dates, dateString) => onChangeRef.current(dateString),
    })
    instance.current = picker
    return () => { picker.destroy(); instance.current = null }
  }, [])

  useEffect(() => {
    instance.current?.set({
      maxDate: options?.maxDate,
      maxTime: options?.maxTime,
      minDate: options?.minDate,
      minTime: options?.minTime,
    })
  }, [options?.maxDate, options?.maxTime, options?.minDate, options?.minTime])

  useEffect(() => {
    if (!instance.current) return
    if (value) instance.current.setDate(value, false)
    else instance.current.clear(false)
  }, [value])

  return <input {...props} ref={input} className={className} defaultValue={value} type="text" />
}

type FlatpickrFieldProps = Omit<FlatpickrInputProps, 'id'> & { id: string; label: string; error?: string }

export function FlatpickrField({ className = '', error, id, label, ...props }: FlatpickrFieldProps) {
  return <div>
    <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>{label}</label>
    <FlatpickrInput {...props} aria-invalid={Boolean(error)} className={`${inputStyles} ${error ? 'border-red-500' : ''} ${className}`} id={id} />
    {error ? <p className="mt-1 text-sm text-red-600" role="alert">{error}</p> : null}
  </div>
}
