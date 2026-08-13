import {
  FaBoxOpen,
  FaChartLine,
  FaClipboardList,
  FaPlus,
  FaStore,
  FaTruck,
} from 'react-icons/fa6'

const metrics = [
  { label: 'Today revenue', value: 'PHP 18,240', change: '+12%' },
  { label: 'Open orders', value: '42', change: '8 urgent' },
  { label: 'Active listings', value: '128', change: '96 in stock' },
]

const orders = [
  { id: 'ORD-1048', buyer: 'Marielle Santos', status: 'Preparing', total: 'PHP 1,480' },
  { id: 'ORD-1047', buyer: 'DLSU Supply Hub', status: 'Ready', total: 'PHP 6,250' },
  { id: 'ORD-1046', buyer: 'Ben Cruz', status: 'Packed', total: 'PHP 890' },
]

function App() {
  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-emerald-600 text-white">
            <FaStore />
          </div>
          <div>
            <p className="text-sm text-slate-500">Marketplace</p>
            <h1 className="text-lg font-semibold">Seller Console</h1>
          </div>
        </div>
        <nav className="mt-8 space-y-1 text-sm font-medium text-slate-600">
          {['Dashboard', 'Products', 'Orders', 'Inventory', 'Analytics'].map((item, index) => (
            <a
              className={`flex items-center rounded-md px-3 py-2 ${index === 0 ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-100'}`}
              href="#"
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
          <div>
            <p className="text-sm text-slate-500">Store overview</p>
            <h2 className="text-2xl font-semibold">Good afternoon, Seller</h2>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            <FaPlus />
            Add product
          </button>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-3 lg:p-8">
          {metrics.map((metric) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={metric.label}>
              <p className="text-sm text-slate-500">{metric.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <strong className="text-2xl">{metric.value}</strong>
                <span className="text-sm font-medium text-emerald-700">{metric.change}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-5 px-5 pb-8 lg:grid-cols-[1.5fr_1fr] lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="font-semibold">Orders to fulfill</h3>
                <p className="text-sm text-slate-500">Prioritize paid orders waiting for handoff.</p>
              </div>
              <FaClipboardList className="text-emerald-600" />
            </div>
            <div className="divide-y divide-slate-100">
              {orders.map((order) => (
                <div className="grid gap-2 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={order.id}>
                  <div>
                    <p className="font-medium">{order.id}</p>
                    <p className="text-sm text-slate-500">{order.buyer}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-600">{order.status}</span>
                  <strong>{order.total}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <FaChartLine className="text-emerald-600" />
              <h3 className="font-semibold">Next actions</h3>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <p className="flex items-center gap-3 text-slate-700">
                <FaBoxOpen className="text-amber-500" />
                Restock 12 low-inventory products.
              </p>
              <p className="flex items-center gap-3 text-slate-700">
                <FaTruck className="text-sky-600" />
                Schedule courier pickup for ready orders.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
