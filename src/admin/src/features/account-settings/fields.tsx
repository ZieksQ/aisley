import { useId } from "react";
type SettingsTextFieldProps = {
  autoComplete?: string;
  errors: Record<string, string[]>;
  label: string;
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
};

export function TextField({
  autoComplete, errors, label, name, onChange, required, type = 'text', value,
}: SettingsTextFieldProps) {
  const id = useId();
  const errorId = errors[name]?.[0] ? `${id}-error` : undefined;
  return <label className="text-sm font-medium">
    {label}
    {required ? <span className="text-rose-600 dark:text-rose-300"> *</span> : null}
    <input
      id={id}
      name={name}
      aria-describedby={errorId}
      aria-invalid={Boolean(errorId)}
      autoComplete={autoComplete}
      className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-[var(--settings-focus)] focus:ring-3 focus:ring-transparent dark:border-white/15 dark:bg-[#171921] dark:focus:ring-transparent"
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
  return errors[name]?.[0] ? <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" id={id ?? `${name}-error`}>
    {errors[name][0]}</span> : null;
}
