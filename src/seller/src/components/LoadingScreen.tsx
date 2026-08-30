import { FaStore } from 'react-icons/fa6'

export function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f8] px-6 text-zinc-900 dark:bg-[#101012] dark:text-white">
      <div className="flex items-center gap-3" role="status">
        <div className="grid size-10 place-items-center rounded-lg bg-[#4C1268] text-white">
          <FaStore aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold">Aisley Seller</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Checking your session…</p>
        </div>
        <span className="sr-only">Loading Seller session</span>
      </div>
    </main>
  )
}
