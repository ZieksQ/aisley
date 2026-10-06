import { Link } from 'react-router-dom'
import { FiMessageCircle } from 'react-icons/fi'
import { ChatNotificationControl, type ChatNotificationPage } from '@aisley/chat-ui'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

const load = (signal: AbortSignal) => apiRequest<ChatNotificationPage>('/api/v1/seller/chat-notifications', { signal, cache: 'no-store' })
const inboxes = [{ label: 'Customer inbox', href: '/messages' }, { label: 'Logistics inbox', href: '/logistics-messages' }, { label: 'Courier inbox', href: '/courier-messages' }]

export function ChatNotifications() {
  const { seller } = useAuth()
  if (!seller) return null
  return <ChatNotificationControl
    key={seller.id}
    load={load}
    icon={<FiMessageCircle aria-hidden="true" className="size-5" />}
    triggerClassName="grid size-10 shrink-0 place-items-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
    inboxes={inboxes}
    destination={(item) => item.kind === 'customer_shop' ? `/messages/${item.id}` : `${item.kind === 'seller_logistics' ? '/logistics-messages' : '/courier-messages'}?conversation=${encodeURIComponent(item.id)}`}
    channelLabel={(item) => item.kind === 'customer_shop' ? 'Customer' : item.kind === 'customer_logistics' ? 'Customer · Order' : item.kind === 'seller_logistics' ? 'Seller · Pickup' : 'Courier · Delivery'}
    renderLink={(href, children, className, onClick) => <Link to={href} className={className} onClick={onClick}>{children}</Link>}
  />
}
