import { DataChart } from '@aisley/ui/charts'
import { LuPackage } from 'react-icons/lu'
import type { CatalogSection } from '../../types/dashboard'

export function CatalogSummary({ catalog }: { catalog: CatalogSection }) {
  const rows = [
    ['Total products', catalog.metrics.total],
    ['Active', catalog.metrics.active],
    ['Draft', catalog.metrics.draft],
    ['Archived', catalog.metrics.archived],
    ['Zero-stock products without variants', catalog.metrics.zero_stock_products],
    ['Zero-stock variant SKUs', catalog.metrics.zero_stock_skus],
  ] as const

  return (
    <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
      <DataChart variant="plain" title="Product status" layout="vertical" height={200} labelWidth={80}
        series={[{ key: 'count', label: 'Products' }]}
        data={[{ label: 'Active', count: catalog.metrics.active }, { label: 'Draft', count: catalog.metrics.draft }, { label: 'Archived', count: catalog.metrics.archived }]}
        emptyMessage="No products recorded for this Shop." />
      <div>
        {catalog.state === 'empty' ? (
          <p className="border-b border-zinc-200 py-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">No products are recorded for this Shop yet.</p>
        ) : null}
        <dl className="divide-y divide-zinc-200 dark:divide-white/10">
          {rows.map(([label, value]) => (
            <div className="flex items-center justify-between gap-4 py-3.5" key={label}>
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="col-span-full flex gap-2 border-t border-zinc-200 py-4 text-xs leading-5 text-zinc-500 dark:border-white/10">
        <LuPackage aria-hidden="true" className="mt-0.5 shrink-0" />
        Catalog quantities are synchronized from the Inventory ledger. Use Inventory to review availability and record adjustments.
      </div>
    </div>
  )
}
