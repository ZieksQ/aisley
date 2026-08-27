import { FaShieldHalved } from 'react-icons/fa6'

export function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fb] px-6 text-slate-900 dark:bg-[#0b0d13] dark:text-white">
      <div className="flex flex-col items-center gap-4" role="status">
        <div className="grid size-12 animate-pulse place-items-center rounded-2xl bg-[#4C1268] text-white shadow-lg shadow-purple-950/20">
          <FaShieldHalved aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Securing your workspace…</p>
        <span className="sr-only">Loading administrator session</span>
      </div>
    </main>
  )
}
