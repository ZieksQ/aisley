import { useEffect, useState } from 'react'
import { FaRotateRight } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { PortalPagination, PortalSkeleton, PortalState, PortalTable } from '@aisley/ui/portal'
import '../features/productFeedback/feedback.css'
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
    let active = true
    document.title = 'Product questions | Aisley Seller'
    setProductInput(productQuery)
    setLoading(true)
    setError('')
    listProductQuestions(status, productQuery, pageNumber)
      .then((result) => { if (active) setPage(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof ApiError ? reason.message : 'Product questions could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
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

  return (
    <div className="portal-page seller-feedback">
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">Product questions</h1>
          <p className="portal-page-description">Answer questions about products in your Shop.</p>
        </div>
        <button aria-label="Refresh product questions" className="portal-button" disabled={loading} onClick={() => setReload((value) => value + 1)} type="button">
          <FaRotateRight aria-hidden="true" /> Refresh
        </button>
      </header>
      <div className="portal-filter-bar feedback-filters">
        <label>Answer state
          <select aria-label="Filter by answer state" className="portal-input" onChange={(event) => updateFilter('status', event.target.value)} value={status}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <form className="feedback-product-search" onSubmit={submitProductFilter}>
          <label>Product
            <input aria-label="Search by product" className="portal-input" onChange={(event) => setProductInput(event.target.value)} placeholder="Search product name" value={productInput} />
          </label>
          <button className="portal-button portal-button-primary" type="submit">Search</button>
        </form>
      </div>
      {error ? <PortalState error title={error} action={<button aria-label="Retry loading product questions" className="portal-button" onClick={() => setReload((value) => value + 1)} type="button">Try again</button>} />
        : loading ? <PortalSkeleton label="Loading product questions…" />
        : page?.data.length === 0 ? <PortalState title="No product questions match this view." description="New questions from Customers will appear here." />
        : page ? <>
          <PortalTable label="Product questions">
            <caption>{page.meta.total} {page.meta.total === 1 ? 'question' : 'questions'} · Asked in Asia/Manila</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">Question</th><th scope="col">State</th><th scope="col">Asked</th><th scope="col" className="portal-row-action">Action</th></tr></thead>
            <tbody>{page.data.map((question) => <tr key={question.id}>
              <td className="portal-table-name">
                <Link className="portal-link font-medium" to={`/products/${question.product.id}/questions/${question.id}`}>{question.product.name}</Link>
                <span className="portal-table-meta capitalize">Product: {question.product.status}</span>
              </td>
              <td className="feedback-text">{question.question}</td>
              <td><span className={`portal-tag portal-tag-${question.state === 'unanswered' ? 'warning' : 'success'}`}>{question.state === 'unanswered' ? 'Needs answer' : 'Answered'}</span></td>
              <td className="feedback-date"><time dateTime={question.askedAt}>{dateTime(question.askedAt)}</time></td>
              <td className="portal-row-action"><Link className="portal-button portal-button-ghost" to={`/products/${question.product.id}/questions/${question.id}`}>{question.state === 'unanswered' ? 'Review' : 'View'}</Link></td>
            </tr>)}</tbody>
          </PortalTable>
          <PortalPagination page={page.meta.current_page} lastPage={page.meta.last_page} total={page.meta.total} onPage={movePage} />
        </> : null}
    </div>
  )
}
