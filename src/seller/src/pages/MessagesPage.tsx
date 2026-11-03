import { useEffect, type ReactNode } from 'react'
import { ChatEmptyState, ChatWorkspace, UnifiedChatInbox, type UnifiedChatPage } from '@aisley/ui/chat'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'
import { MessageThreadPage } from './MessageThreadPage'
import { LogisticsMessagesPage } from './LogisticsMessagesPage'
import { CourierMessagesPage } from './CourierMessagesPage'

const load = (query: string, signal: AbortSignal) => apiRequest<UnifiedChatPage>(
  `/api/v1/seller/chat-inbox?${query}`, { signal, cache: 'no-store' },
)

export function MessagesPage() {
  const { seller } = useAuth()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const kind = params.get('kind')
  const id = params.get('conversation')
  const role = params.get('role') ?? ''
  const filter = ['customer', 'logistics', 'courier'].includes(role) ? role : ''
  const counterpartRole = kind === 'customer_shop' ? 'customer'
    : kind === 'seller_logistics' ? 'logistics'
      : kind === 'courier_seller' ? 'courier' : undefined
  const selected = Boolean(id || params.get('pickup_request_id') || params.get('order'))

  useEffect(() => { document.title = 'Messages | Aisley Seller' }, [])

  function filterRole(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('role', value)
    else next.delete('role')
    setParams(next)
  }

  let thread: ReactNode
  if (selected) {
    if (kind === 'customer_shop' && id) {
      thread = <MessageThreadPage key={id} conversationId={id} embedded />
    } else if (kind === 'seller_logistics') {
      thread = <LogisticsMessagesPage key={id ?? params.get('pickup_request_id')} embedded />
    } else if (kind === 'courier_seller') {
      thread = <CourierMessagesPage key={id ?? params.get('order')} />
    } else {
      thread = <ChatWorkspace entries={[]} selected>
        <ChatEmptyState title="Conversation unavailable" description="Open a conversation from your inbox." />
      </ChatWorkspace>
    }
  }

  return <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6">
    <h2 className={`${selected ? 'hidden min-[800px]:block' : ''} mb-3 px-2 text-xl font-semibold sm:px-0`}>Messages</h2>
    <UnifiedChatInbox
      key={seller?.id}
      load={load}
      roles={['customer', 'logistics', 'courier']}
      filter={filter}
      onFilter={filterRole}
      navigate={navigate}
      conversationId={id}
      counterpartRole={counterpartRole}
    >
      {thread}
    </UnifiedChatInbox>
  </div>
}
