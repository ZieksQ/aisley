import { PortalSkeleton, PortalState } from '@aisley/ui/portal'
import '../features/productFeedback/feedback.css'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FaArrowLeft } from 'react-icons/fa6'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { answerProductQuestion, getProductQuestion } from '../lib/productQA'
import type { SellerProductQuestion } from '../types/productQA'

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 401) return 'Your Seller session expired. Sign in again and retry.'
  if (error.status === 403) return 'You cannot manage this Product question.'
  if (error.status === 404) return 'This Product question is no longer available for answering.'
  if (error.status === 409) return error.message || 'This Product question was answered elsewhere. Refresh to see the latest answer.'
  if (error.status === 429) return 'Too many answer attempts. Wait a moment before trying again.'
  return error.message || fallback
}

export function ProductQuestionDetailPage() {
  const { questionId = '' } = useParams()
  const [question, setQuestion] = useState<SellerProductQuestion | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reload, setReload] = useState(0)
  const keyRef = useRef<{ key: string; answer: string } | null>(null)

  useEffect(() => {
    let active = true
    document.title = 'Product question | Aisley Seller'
    setLoading(true)
    setError('')
    getProductQuestion(questionId)
      .then(({ data }) => {
        if (!active) return
        setQuestion(data)
        setAnswer(data.answer ?? '')
      })
      .catch((reason: unknown) => { if (active) setError(errorMessage(reason, 'This Product question could not be loaded.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [questionId, reload])

  function updateAnswer(value: string) {
    setAnswer(value)
    setSubmitError('')
    setSuccess('')
    if (keyRef.current && keyRef.current.answer !== value) keyRef.current = null
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    setSuccess('')
    const text = answer.trim()
    if (!text) { setSubmitError('Write an answer before submitting.'); return }
    if (text.length > 2000) { setSubmitError('Answers must be 2,000 characters or fewer.'); return }
    const hasControlCharacter = Array.from(text).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
    if (hasControlCharacter || /<[^>]*>|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|`|(?:^|\s)(?:#{1,6}\s|[-*+]\s|\d+\.\s)/u.test(text)) {
      setSubmitError('Answers must be plain text without HTML, Markdown, or scripts.')
      return
    }

    const current = keyRef.current?.answer === text ? keyRef.current : { key: crypto.randomUUID(), answer: text }
    keyRef.current = current
    setSubmitting(true)
    try {
      const result = await answerProductQuestion(questionId, text, current.key)
      setQuestion(result.data)
      setAnswer(result.data.answer ?? text)
      setSuccess('Answer saved. The Customer will receive an in-app notification.')
      keyRef.current = null
    } catch (reason: unknown) {
      setSubmitError(errorMessage(reason, 'The answer could not be saved. Retry with the same answer.'))
      if (reason instanceof ApiError && reason.status === 409) setReload((value) => value + 1)
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="portal-page"><PortalSkeleton label="Loading Product question…" /></div>
  if (error) return (
    <div className="portal-page feedback-detail">
      <Link className="portal-link" to="/product-questions"><FaArrowLeft aria-hidden="true" />Back to Product questions</Link>
      <PortalState error title={error} action={<button className="portal-button" onClick={() => setReload((value) => value + 1)} type="button">Try again</button>} />
    </div>
  )
  if (!question) return null

  const productIsActive = question.product.status === 'active'
  const canAnswer = question.state === 'unanswered' && productIsActive

  return (
    <div className="portal-page feedback-detail">
      <Link className="portal-link" to="/product-questions"><FaArrowLeft aria-hidden="true" />Back to Product questions</Link>
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">{question.product.name}</h1>
          <p className="portal-page-description capitalize">Listing status: {question.product.status}</p>
        </div>
        <span className={`portal-tag portal-tag-${question.state === 'unanswered' ? 'warning' : 'success'}`}>
          {question.state === 'unanswered' ? 'Needs answer' : 'Answered'}
        </span>
      </header>
      <section aria-labelledby="question-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="question-heading">Customer question</h3>
          <time className="text-xs portal-secondary" dateTime={question.askedAt}>{dateTime(question.askedAt)}</time>
        </div>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{question.question}</p>
      </section>
      {question.state === 'answered' ? (
        <section className="mt-5" aria-labelledby="answer-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="answer-heading">Official answer</h3>
            {question.answeredAt ? <time className="text-xs portal-secondary" dateTime={question.answeredAt}>{dateTime(question.answeredAt)}</time> : null}
          </div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{question.answer}</p>
          <p className="mt-4 text-xs portal-secondary">This answer is read-only. Answer editing and history are not enabled.</p>
          {success ? <p className="mt-3 text-sm" role="status">{success}</p> : null}
        </section>
      ) : (
        <section className="mt-5" aria-labelledby="answer-heading">
          <h3 id="answer-heading">Write an official answer</h3>
          {!productIsActive ? <p className="portal-feedback mt-3" role="status">This Product is not active, so the historical question is read-only until the Product is available again.</p> : null}
          {canAnswer ? (
            <form className="mt-4" onSubmit={submit}>
              <label className="text-sm font-medium" htmlFor="product-answer">Answer</label>
              <textarea
                aria-describedby="answer-help"
                aria-invalid={Boolean(submitError)}
                className="portal-input"
                id="product-answer"
                maxLength={2000}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder="Answer the Customer in plain text"
                value={answer}
              />
              <p className="mt-2 text-xs portal-secondary" id="answer-help">Plain text only. {answer.length}/2,000 characters.</p>
              {submitError ? <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{submitError}</p> : null}
              <div className="mt-4 flex justify-end">
                <button className="portal-button portal-button-primary" disabled={submitting} type="submit">
                  {submitting ? 'Saving…' : 'Publish answer'}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      )}
    </div>
  )
}
