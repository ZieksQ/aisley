import { DistributionChart } from '@aisley/ui/charts'
import { LuArrowUpRight, LuPackage, LuPackageSearch } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { CatalogSection } from '../../types/dashboard'

export function CatalogSummary({ catalog }: { catalog: CatalogSection }) {
  const rows = [
    { label: 'Active products', value: catalog.metrics.active, color: 'var(--chart-teal)' },
    { label: 'Drafts', value: catalog.metrics.draft, color: 'var(--chart-amber)' },
    { label: 'Archived', value: catalog.metrics.archived, color: 'var(--chart-slate)' },
  ]
  return <div className="dashboard-columns px-5 py-5">
    <section>
      <div className="dashboard-panel-header"><div><h3>Catalog health</h3><p>{catalog.metrics.total.toLocaleString()} products across your Shop</p></div><Link className="portal-link inline-flex min-h-11 items-center gap-2 text-sm" to="/products">Manage products <LuArrowUpRight aria-hidden="true" /></Link></div>
      <ul className="dashboard-work-list">
        <li><Link to="/inventory"><span className="dashboard-work-icon" aria-hidden="true"><LuPackage size={19} /></span><div><strong className="font-medium">Zero-stock base products</strong><p>Products without variants</p></div><span className="dashboard-work-count">{catalog.metrics.zero_stock_products}</span><LuArrowUpRight aria-hidden="true" /></Link></li>
        <li><Link to="/inventory"><span className="dashboard-work-icon" aria-hidden="true"><LuPackageSearch size={19} /></span><div><strong className="font-medium">Zero-stock variant SKUs</strong><p>Review their Inventory ledger</p></div><span className="dashboard-work-count">{catalog.metrics.zero_stock_skus}</span><LuArrowUpRight aria-hidden="true" /></Link></li>
      </ul>
      <p className="dashboard-chart-caption">Catalog quantities are synchronized from Inventory. Review availability and adjustments in the Inventory workspace.</p>
    </section>
    <DistributionChart variant="plain" title="Product status" totalLabel="products" rows={rows} emptyMessage="No products recorded for this Shop." />
  </div>
}
