import { useMemo, useState } from 'react'
import { FaCheck, FaTriangleExclamation, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'

import { manilaDate, serviceLabels, serviceTypes, peso } from './formatters'
import type { RateCard, ShopCategoryOption } from './types'

export function CoveragePanel({ cards, shopCategories }: { cards: RateCard[]; shopCategories: ShopCategoryOption[] }) {
  const [search, setSearch] = useState('')
  const published = cards.find((card) => card.status === 'published')
  const isEffective = published ? new Date(published.effective_at).getTime() <= Date.now() : false
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return needle ? shopCategories.filter((category) => category.name.toLowerCase().includes(needle)) : shopCategories
  }, [shopCategories, search])

  if (!published) {
    return <section className={"rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)]" + ' p-5'}>
      <h3 className="font-semibold">Commercial service coverage</h3>
      <p className="mt-2 text-sm text-[var(--portal-muted)]">No published rate card is available. Create and publish a card to set service bases and main Shop Category weight/size extras.</p>
    </section>
  }

  const mainRules = published.rules.filter((rule) => rule.shop_category_id !== null)
  const hasLegacyProductRules = published.rules.some((rule) => rule.shop_category_id === null && rule.category_id !== null)
  const hasOnlyLegacyRules = mainRules.length === 0 && hasLegacyProductRules

  return <div className="space-y-4">
    {!isEffective ? <div
      className="flex gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100"
      role="status">
      <FaTriangleExclamation aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>Rate card version {published.version_number} is published but does not take effect until {manilaDate(published.effective_at)}. There is no currently effective commercial coverage.</p>
    </div> : null}
    {hasOnlyLegacyRules ? <div
      className="flex gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100"
      role="status">
      <FaTriangleExclamation aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>This published card has legacy Product Category rules. New quotes need main Shop Category rules. Create and publish a successor card to restore planned rate coverage; existing Orders keep their frozen prices.</p>
    </div> : null}

    <section
      className={"rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)]" + ' overflow-hidden'}>
      <div className="border-b border-[var(--portal-border)] p-4 dark:border-[var(--portal-border)] sm:p-5">
        <h3 className="font-semibold">Service bases</h3>
        <p className="mt-1 text-sm text-[var(--portal-muted)]">Each base is charged once per service leg. Linehaul applies once per hop.</p>
      </div>
      <div aria-label="Service base fees" className="overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-[var(--portal-subtle)] text-xs text-[var(--portal-muted)] dark:bg-white/[0.03]">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-5">
                Service
              </th>
              <th className="px-4 py-3 font-medium">
                Base fee
              </th>
              <th className="px-4 py-3 font-medium">
                Main category rules
              </th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.map((service) => {
              const base = published.services.find((item) => item.service_type === service)
              const ruleCount = mainRules.filter((rule) => rule.service_type === service).length
              return <tr className="border-t border-[var(--portal-border)] dark:border-[var(--portal-border)]" key={service}>
                <th className="px-4 py-3 font-medium sm:px-5">
                  {serviceLabels[service]}
                </th>
                <td className="px-4 py-3">
                  {base ? <span className="font-semibold">{peso(base.base_fee_cents)}</span> : <span className="text-[var(--portal-muted)]">Not offered</span>}
                </td>
                <td className="px-4 py-3">
                  {base ? ruleCount + (ruleCount === 1 ? ' Shop Category rule' : ' Shop Category rules') : <span className="text-[var(--portal-muted)]">—</span>}
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </section>

    <section
      className={"rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)]" + ' overflow-hidden'}>
      <div
        className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--portal-border)] p-4 dark:border-[var(--portal-border)] sm:p-5">
        <div>
          <h3 className="font-semibold">Main Shop Category weight/size extras</h3>
          <p className="mt-1 text-sm text-[var(--portal-muted)]">Version {published.version_number} · {mainRules.length} main-category {mainRules.length === 1 ? 'rule' : 'rules'}</p>
        </div>
        <label className="w-full text-sm font-medium sm:w-72" htmlFor="coverage-search">Find a Shop Category<input
          className={"min-h-11 w-full rounded-lg border border-slate-400 bg-[var(--portal-surface)] px-3 text-sm focus-visible:outline-[var(--brand-focus)] dark:border-slate-500" + ' mt-1.5'}
          id="coverage-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Shop Categories"
          type="search"
          value={search} /></label>
      </div>
      {filtered.length ? <div aria-label="Main Shop Category extra coverage by service leg" className="overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="bg-[var(--portal-subtle)] text-xs text-[var(--portal-muted)] dark:bg-white/[0.03]">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-5">
                Main Shop Category
              </th>
              {serviceTypes.map((service) => <th className="px-4 py-3 font-medium" key={service}>
                {serviceLabels[service]}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((category) => <tr className="border-t border-[var(--portal-border)] dark:border-[var(--portal-border)]" key={category.id}>
              <th className="px-4 py-3 font-medium sm:px-5">
                {category.name}
              </th>
              {serviceTypes.map((service) => {
                const hasBase = published.services.some((item) => item.service_type === service)
                const hasRule = mainRules.some((rule) => rule.shop_category_id === category.id && rule.service_type === service)
                return <td className="px-4 py-3" key={service}>
                  {hasBase && hasRule
                    ? <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><FaCheck aria-hidden="true" />Extra configured</span>
                    : <span className="inline-flex items-center gap-1.5 text-[var(--portal-muted)]">{hasBase ? <><FaXmark aria-hidden="true" />No main-category extra</> : <><FaXmark aria-hidden="true" />Service not offered</>}</span>}
                </td>
              })}
            </tr>)}
          </tbody>
        </table>
      </div> : <p className="p-5 text-sm text-[var(--portal-muted)]">{shopCategories.length ? 'No Shop Categories match this search.' : 'No active Shop Categories are available.'}</p>}
    </section>
    <p className="text-sm leading-6 text-[var(--portal-muted)]">This coverage is commercial by a Shop's main category and service leg. Different Product Categories in one parcel share its main Shop Category rate. Geographic hub connections and postal routing remain in <Link
      className="font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline dark:text-[var(--portal-accent)]"
      to="/sort-plan">
      Sort plan
    </Link> and <Link
      className="font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline dark:text-[var(--portal-accent)]"
      to="/network">
        Network
      </Link>.</p>
  </div>
}
