import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowLeft, FiCheckCircle, FiShield, FiTruck } from "react-icons/fi";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#FCFAFD] lg:grid lg:grid-cols-[minmax(340px,0.82fr)_minmax(600px,1.18fr)]">
      <aside className="relative hidden overflow-hidden bg-[#4C1268] px-10 py-10 text-white lg:flex lg:min-h-dvh lg:flex-col xl:px-16 xl:py-12">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 size-80 rounded-full bg-[#E6007A]/25 blur-sm"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-36 -left-28 size-[28rem] rounded-full border-[90px] border-white/[0.06]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-28 right-12 size-36 rotate-12 rounded-[2.5rem] bg-[#E6007A]/15"
        />

        <Link
          href="/"
          aria-label="Aisley home"
          className="relative z-10 inline-flex w-fit rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
        >
          <Image
            src="/aisley-logo-with-title.svg"
            alt="Aisley"
            width={181}
            height={60}
            priority
            className="h-auto w-[156px] xl:w-[181px]"
          />
        </Link>

        <div className="relative z-10 my-auto max-w-md py-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#FFB6D8]">
            Your everyday marketplace
          </p>
          <h2 className="text-4xl font-bold leading-[1.15] tracking-[-0.035em] xl:text-5xl">
            Great finds are just a sign-in away.
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-white/75">
            Join a marketplace built around trusted local sellers, reliable
            delivery, and shopping that feels effortless.
          </p>

          <ul className="mt-10 space-y-5 text-sm font-medium text-white/90">
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/10">
                <FiCheckCircle aria-hidden="true" className="size-4" />
              </span>
              Discover products from approved sellers
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/10">
                <FiShield aria-hidden="true" className="size-4" />
              </span>
              Secure account and checkout experience
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/10">
                <FiTruck aria-hidden="true" className="size-4" />
              </span>
              Track every order from shop to doorstep
            </li>
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/55">
          © {new Date().getFullYear()} Aisley. Shop with confidence.
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between border-b border-[#EEE8F0] bg-[#4C1268] px-5 py-4 lg:border-0 lg:bg-transparent lg:px-10 lg:pt-8 xl:px-16">
          <Link
            href="/"
            aria-label="Aisley home"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 lg:hidden"
          >
            <Image
              src="/aisley-logo-with-title.svg"
              alt="Aisley"
              width={119}
              height={40}
              priority
              className="h-auto w-[119px]"
            />
          </Link>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-white/90 transition hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20 lg:text-[#5F5363] lg:hover:text-[#4C1268] lg:focus-visible:ring-[#4C1268]/15"
          >
            <FiArrowLeft aria-hidden="true" />
            Back to store
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-10 lg:py-12 xl:px-16">
          {children}
        </main>

        <footer className="px-5 pb-6 text-center text-xs leading-5 text-[#807484] sm:px-8 lg:px-10 xl:px-16">
          Secure customer access powered by Aisley.
        </footer>
      </div>
    </div>
  );
}
