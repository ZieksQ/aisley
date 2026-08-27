import type { ReactNode, SelectHTMLAttributes } from "react";

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  error?: string;
  label: string;
};

export function SelectField({
  children,
  className = "",
  error,
  id,
  label,
  ...props
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-[#31123F]">
        {label}
      </label>
      <select
        id={id}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        className={`min-h-12 w-full appearance-none rounded-xl border bg-white px-3.5 text-[15px] text-[#231429] outline-none transition focus:ring-4 ${
          error
            ? "border-[#FF3B30] focus:border-[#FF3B30] focus:ring-[#FF3B30]/10"
            : "border-[#D9D3DE] focus:border-[#4C1268] focus:ring-[#4C1268]/10"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-[#D8271F]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
