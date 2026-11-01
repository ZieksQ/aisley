import { useState } from 'react'
import { LuArrowUpRight, LuPlus } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { ConfirmationDialog, PortalButton, PortalState, PortalTable } from '@aisley/ui/portal'
import { manilaDate } from './formatters'
import { RateCardForm } from './RateCardForm'
import type { RateCard, RateCardDraft, ShopCategoryOption } from './types'

type Props = {
  cards: RateCard[]
  shopCategories: ShopCategoryOption[]
  publishingId: string | null
  onCreate: (draft: RateCardDraft) => Promise<void>
  onPublish: (id: string) => Promise<void>
}

export function RateCardsPanel({ cards, onCreate, onPublish, publishingId, shopCategories }: Props) {
  const [creating, setCreating] = useState(false)
  const [publishing, setPublishing] = useState<RateCard | null>(null)

  if (creating) return <section className="portal-panel">
    <header className="portal-page-header">
      <div>
        <h3 className="text-lg font-semibold">Create rate card</h3>
        <p className="portal-page-description">Set service bases and main Shop Category extras. Saving creates an immutable draft for review.</p>
      </div>
    </header>
    <RateCardForm
      shopCategories={shopCategories}
      onCancel={() => setCreating(false)}
      onCreate={async (draft) => { await onCreate(draft); setCreating(false) }} />
  </section>

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold">Rate card versions</h3>
        <p className="portal-page-description">Review each version's service bases, weight extras, and parcel limits before publishing.</p>
      </div>
      <PortalButton variant="primary" disabled={!shopCategories.length} onClick={() => setCreating(true)}>
        <LuPlus aria-hidden="true" />
        Create rate card
      </PortalButton>
    </div>
    {!shopCategories.length ? <p className="portal-feedback" role="status">No active Shop Categories are available, so a rate card cannot be created.</p> : null}
    {cards.length ? <PortalTable label="Rate card versions">
      <thead>
        <tr>
          <th scope="col">
            Version
          </th>
          <th scope="col">
            Effective · Manila time
          </th>
          <th scope="col">
            Services
          </th>
          <th scope="col">
            Category rules
          </th>
          <th scope="col">
            Status
          </th>
          <th scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => <tr key={card.id}>
          <td className="font-medium whitespace-nowrap">
            {`Version ${card.version_number}`}
            <span className="portal-table-meta">{card.currency} · revision {card.revision}</span>
          </td>
          <td className="whitespace-nowrap">
            {manilaDate(card.effective_at)}
            {card.status === 'published' && new Date(card.effective_at).getTime() > Date.now() ? <span className="portal-table-meta">Not yet effective</span> : null}
          </td>
          <td>
            {card.services.length}
          </td>
          <td>
            {card.rules.filter((rule) => rule.shop_category_id).length}
            <span className="portal-table-meta">Main Shop Category</span>
          </td>
          <td>
            <span
              className={`portal-tag capitalize ${card.status === 'published' ? 'portal-tag-success' : card.status === 'draft' ? 'portal-tag-warning' : ''}`}>{card.status}</span>
          </td>
          <td>
            <div className="portal-inline-actions flex-nowrap">
              <Link
                className="portal-button portal-button-ghost whitespace-nowrap"
                to={`/shipping-rates/rate-cards/${encodeURIComponent(card.id)}`}>
                View version
                <LuArrowUpRight aria-hidden="true" />
                <span className="sr-only"> {card.version_number}</span>
              </Link>
              {card.status === 'draft' ? <PortalButton disabled={publishingId !== null} onClick={() => setPublishing(card)}>
                Publish
              </PortalButton> : null}
            </div>
          </td>
        </tr>)}
      </tbody>
    </PortalTable> : <PortalState
      title="No rate cards yet"
      description="Create a draft with service bases and main Shop Category rules, then review and publish it." />}
    <p className="portal-secondary max-w-3xl text-sm leading-6">Versions are immutable. Publishing archives the previous published card. Placed orders retain their frozen prices.</p>
    {publishing ? <ConfirmationDialog
      title={`Publish version ${publishing.version_number}?`}
      confirmLabel="Publish rate card"
      busy={publishingId !== null}
      onClose={() => setPublishing(null)}
      onConfirm={() => { void onPublish(publishing.id).then(() => setPublishing(null)) }}>
      <p>The current published version will be archived. This card takes effect {manilaDate(publishing.effective_at)}. Placed-order prices remain unchanged.</p>
    </ConfirmationDialog> : null}
  </div>
}
