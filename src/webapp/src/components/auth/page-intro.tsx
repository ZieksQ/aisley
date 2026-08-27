import type { ReactNode } from "react";

export function PageIntro({
  description,
  eyebrow,
  title,
}: {
  description: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#E6007A]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-bold tracking-[-0.035em] text-[#31123F] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-[15px] leading-6 text-[#746778]">{description}</p>
    </div>
  );
}
