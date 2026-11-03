import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { announceChatChange, ChatWorkspace } from '@aisley/ui/chat'
import { useAuth } from '../auth/useAuth'
import { CourierThread } from '../components/courier-messages/CourierThread'

export function CourierMessagesPage() {
  const { seller } = useAuth()
  const [params, setParams] = useSearchParams()
  const conversationId = params.get('conversation')
  const orderId = params.get('order')
  const onStarted = useCallback((id: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('order')
      next.set('kind', 'courier_seller')
      next.set('conversation', id)
      return next
    }, { replace: true })
  }, [setParams])

  return <ChatWorkspace entries={[]} selected>
    <CourierThread
      key={`${seller?.id}:${conversationId ?? orderId}`}
      conversationId={conversationId}
      orderId={orderId}
      onUpdated={announceChatChange}
      onStarted={onStarted}
    />
  </ChatWorkspace>
}
