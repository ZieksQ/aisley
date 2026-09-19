import { useEffect } from 'react'
import { FaArrowLeft } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { panel } from '../components/PickupUi'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found | Aisley Logistics'
  }, [])

  return <div className="grid min-h-[calc(100vh-4rem)] place-items-center p-5 sm:p-8">
    <section aria-labelledby="not-found-title" className={`${panel} w-full max-w-lg p-6 text-center sm:p-8`}>
      <p aria-hidden="true" className="text-6xl font-semibold tracking-tight text-[#4C1268] dark:text-purple-300">404</p>
      <h2 className="mt-3 text-xl font-semibold" id="not-found-title">Page not found</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">The Logistics page you requested does not exist or has moved.</p>
      <Link className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]" to="/dashboard"><FaArrowLeft aria-hidden="true" />Return to dashboard</Link>
    </section>
  </div>
}
