import type { InputHTMLAttributes } from 'react';
import { useId } from "react";
export const sectionClass = 'mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6';
export const sectionClassNoMargin = 'rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6';
export const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[var(--settings-focus)] focus:ring-2 focus:ring-transparent dark:border-white/15 dark:bg-[#171719] dark:focus:ring-transparent';
export const primaryButtonClass = 'h-10 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white disabled:opacity-50';
type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'onChange' | 'value'> & {
  errors: Record<string, string[]>;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
};
export function TextField({ autoComplete, errors, label, name, onChange, required, type = 'text', value, ...props }: TextFieldProps) {
  const id = useId();
  const errorId = errors[name]?.[0] ? `${id}-error` : undefined;
  return <label className="text-sm font-medium">
    {label}
    {required ? <span className="text-red-600"> *</span> : null}
    <input
      {...props}
      id={id}
      aria-describedby={errorId}
      aria-invalid={Boolean(errorId)}
      autoComplete={autoComplete}
      className={inputClass}
      name={name}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      type={type}
      value={value}
    />
    <FieldError
      errors={errors}
      name={name}
      id={errorId}
    />
  </label>;
}
export function FieldError({ errors, name, id }: { errors: Record<string, string[]>; name: string; id?: string; }) {
  return errors[name]?.[0] ? <span className="mt-1 block text-xs text-red-700 dark:text-red-300" id={id ?? `${name}-error`}>
    {errors[name][0]}</span> : null;
}
export function FormActions({ busy, disabled = busy, label, progress }: { busy: boolean; disabled?: boolean; label: string; progress: string; }) {
  return <div className="mt-5 flex justify-end border-t border-zinc-200 pt-5 dark:border-white/10">
    <button className={primaryButtonClass} disabled={disabled}>
      {busy ? progress : label}
    </button>
  </div>;
}
