import { Navigate, useParams, useSearchParams } from 'react-router-dom'

export function LegacyMessageRedirect({ kind }: { kind: string }) {
  const [params] = useSearchParams()
  const { conversationId } = useParams()
  const next = new URLSearchParams(params)
  next.set('kind', kind)
  if (conversationId) next.set('conversation', conversationId)
  return <Navigate replace to={`/messages?${next}`} />
}
