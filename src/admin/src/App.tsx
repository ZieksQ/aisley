import {
  FaChartPie,
  FaCircleCheck,
  FaHeadset,
  FaScaleBalanced,
  FaShieldHalved,
  FaStore,
  FaUserGroup,
} from 'react-icons/fa6'

const stats = [
  { label: 'Gross merchandise value', value: 'PHP 842K', note: '+18% month over month' },
  { label: 'Pending seller applications', value: '17', note: '5 awaiting document review' },
  { label: 'Customer tickets', value: '29', note: '11 high priority' },
]

const reviews = [
  { name: 'North Campus Supplies', status: 'Documents verified', action: 'Approve' },
  { name: 'Everyday Uniforms Co.', status: 'Tax profile incomplete', action: 'Review' },
  { name: 'LabWorks PH', status: 'Needs category check', action: 'Assign' },
]

function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-slate-950 px-5 py-6 text-white lg:block">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-sky-500">
            <FaShieldHalved />
          </div>
          <div>
            <p className="text-sm text-slate-400">Marketplace</p>
            <h1 className="text-lg font-semibold">Admin Console</h1>
          </div>
        </div>
        <nav className="mt-8 space-y-1 text-sm font-medium text-slate-300">
          {['Dashboard', 'Sellers', 'Customers', 'Orders', 'Support', 'Tax'].map((item, index) => (
            <a
              className={`flex items-center rounded-md px-3 py-2 ${index === 0 ? 'bg-white text-slate-950' : 'hover:bg-slate-800'}`}
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
            <p className="text-sm text-slate-500">Platform operations</p>
            <h2 className="text-2xl font-semibold">Marketplace health</h2>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            <FaCircleCheck />
            Review queue
          </button>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-3 lg:p-8">
          {stats.map((stat) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={stat.label}>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <strong className="mt-3 block text-2xl">{stat.value}</strong>
              <span className="mt-2 block text-sm font-medium text-sky-700">{stat.note}</span>
            </article>
          ))}
        </div>

        <div className="grid gap-5 px-5 pb-8 lg:grid-cols-[1.5fr_1fr] lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="font-semibold">Seller approval queue</h3>
                <p className="text-sm text-slate-500">Verify store readiness before publishing.</p>
              </div>
              <FaStore className="text-sky-600" />
            </div>
            <div className="divide-y divide-slate-100">
              {reviews.map((review) => (
                <div className="grid gap-2 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={review.name}>
                  <div>
                    <p className="font-medium">{review.name}</p>
                    <p className="text-sm text-slate-500">{review.status}</p>
                  </div>
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                    {review.action}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <FaChartPie className="text-sky-600" />
              <h3 className="font-semibold">Governance focus</h3>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <p className="flex items-center gap-3 text-slate-700">
                <FaUserGroup className="text-violet-600" />
                Monitor seller onboarding completion.
              </p>
              <p className="flex items-center gap-3 text-slate-700">
                <FaScaleBalanced className="text-amber-600" />
                Review tax settings before next payout.
              </p>
              <p className="flex items-center gap-3 text-slate-700">
                <FaHeadset className="text-rose-600" />
                Clear high-priority support tickets.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
