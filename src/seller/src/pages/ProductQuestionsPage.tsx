import { useEffect, useState } from 'react'
import { FaComments, FaRotateRight } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { listProductQuestions, type ProductQuestionStatus } from '../lib/productQA'
import type { SellerProductQuestionPage } from '../types/productQA'

const statusOptions: Array<[ProductQuestionStatus, string]> = [
  ['all', 'All questions'],
  ['unanswered', 'Needs an answer'],
  ['answered', 'Answered'],
]

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

export function ProductQuestionsPage() {
  const [params, setParams] = useSearchParams()
  const requestedStatus = params.get('status')
  const status = statusOptions.some(([value]) => value === requestedStatus) ? requestedStatus as ProductQuestionStatus : 'all'
  const productQuery = params.get('product') ?? ''
  const pageNumber = Math.max(1, Number(params.get('page')) || 1)
  const [productInput, setProductInput] = useState(productQuery)
  const [page, setPage] = useState<SellerProductQuestionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    document.title = 'Product questions | Aisley Seller'
    setProductInput(productQuery)
    setLoading(true)
    setError('')
    listProductQuestions(status, productQuery, pageNumber)
      .then(setPage)
      .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'Product questions could not be loaded.'))
      .finally(() => setLoading(false))
  }, [pageNumber, productQuery, reload, status])

  function updateFilter(key: 'status' | 'product', value: string) {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  function submitProductFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateFilter('product', productInput.trim())
  }

  function movePage(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setParams(next)
  }

  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Product questions</h2>
        <p className="mt-1 text-sm text-zinc-500">Answer questions about products in your Shop.</p>
      </div>
      <button aria-label="Refresh product questions" className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/[0.06]" onClick={() => setReload((value) => value + 1)} type="button">
        <FaRotateRight aria-hidden="true" /> Refresh
      </button>
    </div>

    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="text-sm font-medium sm:w-56">Answer state<select aria-label="Filter by answer state" className="mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => updateFilter('status', event.target.value)} value={status}>
        {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <form className="flex flex-1 gap-2" onSubmit={submitProductFilter}>
        <label className="min-w-0 flex-1 text-sm font-medium">Product<input aria-label="Search by product" className="mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => setProductInput(event.target.value)} placeholder="Search product name" value={productInput} /></label>
        <button className="mt-7 h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-medium text-white hover:bg-[#3d0e54]" type="submit">Search</button>
      </form>
    </div>

    {error ? <div className="mt-5 flex items-center justify-between border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert"><span>{error}</span><button aria-label="Retry loading product questions" className="font-semibold underline" onClick={() => setReload((value) => value + 1)} type="button">Try again</button></div> : null}
    {loading ? <p className="py-12 text-center text-sm text-zinc-500" role="status">Loading product questions…</p> : null}
    {!loading && !error && page?.data.length === 0 ? <div className="mt-5 border border-dashed border-zinc-300 bg-white px-5 py-12 text-center dark:border-white/15 dark:bg-[#18181b]"><FaComments aria-hidden="true" className="mx-auto text-zinc-400" /><p className="mt-3 text-sm font-medium">No product questions match this view.</p><p className="mt-1 text-sm text-zinc-500">New questions from Customers will appear here.</p></div> : null}
    {!loading && !error && page && page.data.length > 0 ? <>
      <p className="mt-5 mb-3 text-sm text-zinc-600 dark:text-zinc-400">{page.meta.total} {page.meta.total === 1 ? 'question' : 'questions'}</p>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Question</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Asked</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">{page.data.map((question) => <tr key={question.id} className="align-top hover:bg-zinc-50 dark:hover:bg-white/[0.03]"><td className="px-4 py-4"><Link className="font-medium text-[#4C1268] hover:underline dark:text-purple-300" to={`/products/${question.product.id}/questions/${question.id}`}>{question.product.name}</Link><p className="mt-1 text-xs capitalize text-zinc-500">Product: {question.product.status}</p></td><td className="max-w-md px-4 py-4 leading-6">{question.question}</td><td className="px-4 py-4"><span className={question.state === 'unanswered' ? 'font-medium text-amber-700 dark:text-amber-300' : 'font-medium text-emerald-700 dark:text-emerald-300'}>{question.state === 'unanswered' ? 'Needs answer' : 'Answered'}</span></td><td className="whitespace-nowrap px-4 py-4 text-zinc-500">{dateTime(question.askedAt)}</td><td className="px-4 py-4 text-right"><Link className="font-medium text-[#4C1268] hover:underline dark:text-purple-300" to={`/products/${question.product.id}/questions/${question.id}`}>{question.state === 'unanswered' ? 'Review' : 'View'}</Link></td></tr>)}</tbody>
          </table>
        </div>
      </div>
      {page.meta.last_page > 1 ? <nav aria-label="Product question pages" className="mt-4 flex items-center justify-between text-sm"><button className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-white/15" disabled={page.meta.current_page <= 1} onClick={() => movePage(page.meta.current_page - 1)} type="button">Previous</button><span className="text-zinc-500">Page {page.meta.current_page} of {page.meta.last_page}</span><button className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-white/15" disabled={page.meta.current_page >= page.meta.last_page} onClick={() => movePage(page.meta.current_page + 1)} type="button">Next</button></nav> : null}
    </> : null}
  </div>
}
