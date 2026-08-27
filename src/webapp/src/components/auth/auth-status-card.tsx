import Link from "next/link";
import type { ReactNode } from "react";

export function AuthStatusCard({
  actionHref,
  actionLabel,
  description,
  icon,
  secondaryAction,
  title,
  tone = "primary",
}: {
  actionHref: string;
  actionLabel: string;
  description: ReactNode;
  icon: ReactNode;
  secondaryAction?: { href: string; label: string };
  title: string;
  tone?: "error" | "primary";
}) {
  const error = tone === "error";

  return (
    <section className="w-full max-w-md text-center">
      <div
        className={`mx-auto grid size-20 place-items-center rounded-full ${
          error ? "bg-red-50 text-[#D8271F]" : "bg-[#FCE7F3] text-[#E6007A]"
        }`}
      >
        {icon}
      </div>
      <h1 className="mt-7 text-3xl font-bold tracking-[-0.035em] text-[#31123F] sm:text-4xl">
        {title}
      </h1>
      <div className="mx-auto mt-4 max-w-sm text-[15px] leading-7 text-[#746778]">
        {description}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href={actionHref}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#E6007A] px-5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(230,0,122,0.2)] transition hover:bg-[#C9006B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E6007A]/25"
        >
          {actionLabel}
        </Link>
        {secondaryAction ? (
          <Link
            href={secondaryAction.href}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#D9D3DE] bg-white px-5 text-sm font-semibold text-[#31123F] transition hover:border-[#4C1268]/45 hover:bg-[#F9F6FA] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4C1268]/15"
          >
            {secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
