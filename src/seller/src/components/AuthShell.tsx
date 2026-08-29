import type { PropsWithChildren, ReactNode } from 'react'
import { FaStore } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

type AuthShellProps = PropsWithChildren<{
  title: string
  description: string
  footer?: ReactNode
  wide?: boolean
}>

export function AuthShell({ children, description, footer, title, wide = false }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-5 text-zinc-950 dark:bg-[#101012] dark:text-white sm:px-6 sm:py-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E6007A]" to="/login">
          <span className="grid size-10 place-items-center rounded-lg bg-[#4C1268] text-white">
            <FaStore aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold">Aisley</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">Seller workspace</span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <section className={`mx-auto my-10 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#18181b] sm:my-14 sm:p-8 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
        <div className="mt-7">{children}</div>
        {footer ? <div className="mt-7 border-t border-zinc-200 pt-5 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">{footer}</div> : null}
      </section>
    </main>
  )
}
