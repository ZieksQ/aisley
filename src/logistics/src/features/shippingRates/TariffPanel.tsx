import { FaCheck, FaTriangleExclamation } from 'react-icons/fa6'
import { ActionButton, panel } from '../../components/PickupUi'
import { centimeters, kilograms, manilaDate, peso } from './formatters'
import type { TariffAcceptance } from './types'

type Props = {
  tariffs: TariffAcceptance[]
  acceptingId: string | null
  onAccept: (id: string) => Promise<void>
}

function AcceptanceState({ tariff }: { tariff: TariffAcceptance }) {
  return tariff.accepted
    ? <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300"><FaCheck aria-hidden="true" />Accepted</span>
    : <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300"><FaTriangleExclamation aria-hidden="true" />Action required</span>
}

export function TariffPanel({ acceptingId, onAccept, tariffs }: Props) {
  const current = tariffs[0]

  if (!current) {
    return <section className={`${panel} p-5`}><h3 className="font-semibold">Platform tariff</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No published platform tariff is available. Rate cards can be prepared, but your organization cannot be quoted until an Admin publishes a tariff.</p></section>
  }

  const { rate } = current

  return <div className="space-y-4">
    {!current.accepted ? <div className="flex gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100" role="status"><FaTriangleExclamation aria-hidden="true" className="mt-0.5 shrink-0" /><p>The newest tariff must be accepted exactly as published before Sellers can select this organization under version {rate.version_number}.</p></div> : null}

    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-4 dark:border-white/10 sm:p-5">
        <div><h3 className="font-semibold">Current platform tariff</h3><p className="mt-1 text-sm text-zinc-500">Version {rate.version_number} · effective {manilaDate(rate.effective_at)}</p><p className="mt-2 text-sm text-zinc-500">This tariff sets destination-region surcharges and read-only parcel policy. Service bases and category extras are managed in Rate cards.</p></div>
        <div className="flex items-center gap-3"><AcceptanceState tariff={current} />{!current.accepted ? <ActionButton busy={acceptingId === rate.id} onClick={() => { if (window.confirm(`Accept platform tariff version ${rate.version_number} as published? This enables your organization to participate in quotes under this exact version.`)) void onAccept(rate.id) }}>Accept tariff</ActionButton> : null}</div>
      </div>
      <dl aria-label="Read-only parcel policy" className="grid gap-x-6 gap-y-5 p-4 text-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <div><dt className="text-zinc-500 dark:text-zinc-400">Volumetric divisor</dt><dd className="mt-1 font-semibold">{rate.volumetric_divisor.toLocaleString('en-PH')}</dd></div>
        <div><dt className="text-zinc-500 dark:text-zinc-400">Maximum weight</dt><dd className="mt-1 font-semibold">{kilograms(rate.max_weight_grams)}</dd></div>
        <div><dt className="text-zinc-500 dark:text-zinc-400">Maximum dimensions</dt><dd className="mt-1 font-semibold">{centimeters(rate.max_length_mm)} × {centimeters(rate.max_width_mm)} × {centimeters(rate.max_height_mm)}</dd></div>
      </dl>
      <div className="border-t border-zinc-200 p-4 dark:border-white/10 sm:p-5"><h4 className="text-sm font-semibold">Destination-region surcharges</h4>{rate.region_surcharges.length ? <div className="mt-3 overflow-x-auto" tabIndex={0} aria-label="Destination-region surcharges"><table className="w-full min-w-[28rem] text-left text-sm"><thead className="text-xs text-zinc-500"><tr><th className="pb-2 font-medium">Region</th><th className="pb-2 text-right font-medium">Surcharge</th></tr></thead><tbody>{rate.region_surcharges.map((item) => <tr className="border-t border-zinc-200 dark:border-white/10" key={item.id}><td className="py-2.5">{item.destination_region}</td><td className="py-2.5 text-right font-medium">{peso(item.surcharge_cents)}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-zinc-500">No regional surcharges apply to this tariff.</p>}</div>
    </section>

    {tariffs.length > 1 ? <section className={`${panel} overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-5"><h3 className="font-semibold">Published tariff history</h3></div><ul className="divide-y divide-zinc-200 dark:divide-white/10">{tariffs.slice(1).map((tariff) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5" key={tariff.rate.id}><div><p className="font-medium">Version {tariff.rate.version_number}</p><p className="mt-0.5 text-xs text-zinc-500">Effective {manilaDate(tariff.rate.effective_at)}{tariff.accepted_at ? ` · accepted ${manilaDate(tariff.accepted_at)}` : ''}</p></div><AcceptanceState tariff={tariff} /></li>)}</ul></section> : null}
  </div>
}
