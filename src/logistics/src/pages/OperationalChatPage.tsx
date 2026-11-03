import { useEffect, useState, type CSSProperties, type ComponentProps } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UnifiedChatInbox, type UnifiedChatPage, ChatLoadingThread, ChatWorkspace, clearChatPrivateState } from '@aisley/ui/chat'
import { OperationalThreadPanel } from '../components/OperationalThreadPanel'
import { useAuth } from '../auth/useAuth'
import { ApiError, request } from '../lib/api'
import { operationalChat, type OperationalThread } from '../lib/operationalChat'

const loadInbox = (query: string, signal: AbortSignal) => request<UnifiedChatPage>(`/api/v1/logistics/chat-inbox?${query}`, { signal, cache: 'no-store' })

export function OperationalChatPage() {
  const { logistics } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const role = params.get('role') ?? ''
  const filter = ['customer', 'seller', 'courier'].includes(role) ? role : ''
  const selected = Boolean(params.get('conversation') || params.get('task_id') || params.get('order_id') || params.get('pickup_request_id'))
  useEffect(() => { document.title = 'Messages | Aisley Logistics' }, [])

  function filterRole(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('role', value)
    else next.delete('role')
    setParams(next)
  }

  return <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6" style={{ '--chat-brand': '#2563EB', '--chat-tint': '#EFF6FF', '--chat-focus': '#93C5FD' } as CSSProperties}>
    <h2 className={`${selected ? 'hidden min-[800px]:block' : ''} mb-3 px-2 text-xl font-semibold sm:px-0`}>Messages</h2>
    <UnifiedChatInbox key={logistics?.id} load={loadInbox} roles={['customer', 'seller', 'courier']} filter={filter}
      onFilter={filterRole}
      navigate={navigate} conversationId={params.get('conversation')}>
      {selected ? <OperationalConversation key={params.get('conversation') ?? params.get('task_id') ?? params.get('order_id') ?? params.get('pickup_request_id')} /> : undefined}
    </UnifiedChatInbox>
  </div>
}

function OperationalConversation() {
  const [params, setParams] = useSearchParams()
  const conversationId = params.get('conversation')
  const leg = params.get('leg')
  const taskId = params.get('task_id')
  const orderId = params.get('order_id')
  const pickupRequestId = params.get('pickup_request_id')
  const [selected, setSelected] = useState<OperationalThread | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const context: ComponentProps<typeof OperationalThreadPanel>['context'] = pickupRequestId ? { pickupRequestId }
    : orderId ? { orderId }
      : (leg === 'first_mile' || leg === 'final_mile') && taskId ? { leg, taskId } : null

  useEffect(() => {
    let active = true
    if (conversationId) {
      void operationalChat.show(conversationId).then(({ data }) => {
        if (active) { setSelected(data); setError('') }
      }).catch((caught) => {
        if (!active) return
        if (caught instanceof ApiError && [401, 403].includes(caught.status)) clearChatPrivateState()
        setError(caught instanceof Error ? caught.message : 'This conversation could not be loaded.')
      })
    }
    return () => { active = false }
  }, [conversationId, revision])

  function saved(thread: OperationalThread) {
    setSelected(thread)
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ['leg', 'task_id', 'order_id', 'pickup_request_id']) next.delete(key)
      next.set('kind', thread.kind)
      next.set('conversation', thread.id)
      return next
    })
  }

  return <ChatWorkspace entries={[]} selected>
    {selected || context ? <OperationalThreadPanel context={context} onSaved={saved} selected={selected} />
      : error ? <p className="m-4 text-sm" role="alert">{error} <button className="min-h-11 px-2 font-semibold underline" onClick={() => setRevision((value) => value + 1)} type="button">Retry</button></p>
        : <ChatLoadingThread />}
  </ChatWorkspace>
}
