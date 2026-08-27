import type { InputHTMLAttributes, ReactNode } from "react";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  error?: string;
  hint?: string;
  label: string;
  leadingIcon?: ReactNode;
  trailingElement?: ReactNode;
};

export function TextField({
  className = "",
  error,
  hint,
  id,
  label,
  leadingIcon,
  trailingElement,
  ...props
}: TextFieldProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-[#31123F]">
        {label}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-[#746778]"
          >
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={id}
          aria-describedby={descriptionId}
          aria-invalid={Boolean(error)}
          className={`min-h-12 w-full rounded-xl border bg-white px-3.5 text-[15px] text-[#231429] outline-none transition placeholder:text-[#9B919E] focus:ring-4 ${
            leadingIcon ? "pl-11" : ""
          } ${trailingElement ? "pr-12" : ""} ${
            error
              ? "border-[#FF3B30] focus:border-[#FF3B30] focus:ring-[#FF3B30]/10"
              : "border-[#D9D3DE] focus:border-[#4C1268] focus:ring-[#4C1268]/10"
          } ${className}`}
          {...props}
        />
        {trailingElement ? (
          <span className="absolute inset-y-0 right-0 flex w-12 items-center justify-center">
            {trailingElement}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-[#D8271F]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-[#746778]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
