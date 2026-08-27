import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#E6007A] text-white shadow-[0_10px_28px_rgba(230,0,122,0.2)] hover:bg-[#C9006B] focus-visible:ring-[#E6007A]/25",
  secondary:
    "bg-[#4C1268] text-white shadow-[0_10px_28px_rgba(76,18,104,0.18)] hover:bg-[#3D0E54] focus-visible:ring-[#4C1268]/25",
  outline:
    "border border-[#D9D3DE] bg-white text-[#31123F] hover:border-[#4C1268]/45 hover:bg-[#F9F6FA] focus-visible:ring-[#4C1268]/15",
  ghost:
    "bg-transparent text-[#4C1268] hover:bg-[#F7F0F9] focus-visible:ring-[#4C1268]/15",
};

export function Button({
  children,
  className = "",
  disabled,
  isLoading = false,
  loadingLabel = "Please wait",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
