import { AccountSettingsFeedback } from "@aisley/ui/account-settings";
import { LuSave } from 'react-icons/lu';
import { TextField as Field } from "@aisley/ui";
import { HubLocationPicker, type HubAddress } from '../../components/HubLocationPicker';
import type { useAccountSettings } from './use-account-settings';
const errorFor = (errors: Record<string, string[]>, field: string) => errors[field]?.[0];

export function OrganizationSettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const {
    account,
    organization,
    setOrganization,
    organizationErrors,
    organizationMessage,
    organizationSaving,
    hubLocation,
    setHubLocation,
    hubLocationConfirmed,
    setHubLocationConfirmed,
    hubLocationReason,
    setHubLocationReason,
    hubLocationError,
    hubLocationMessage,
    setHubLocationMessage,
    hubLocationSaving,
    geoapifyApiKey,
    saveOrganization,
    saveHubLocation,
  } = settings;
  if (!account) return null;
  const address = account.hub.address;
  const hubAddress: HubAddress | undefined = address ? { addressLine1: address.address_line_1 ?? '', barangay: address.barangay ?? '', cityMunicipality: address.city_municipality ?? '', province: address.province ?? '', region: address.region ?? '', postalCode: address.postal_code ?? '', country: address.country ?? 'Philippines' } : undefined;
  return <>
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div>
        <h3 className="font-semibold">Organization</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Update the organization label and the display name of its sole hub.</p>
      </div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void saveOrganization(event)}>
        <AccountSettingsFeedback error={Object.values(organizationErrors).flat()[0]} message={organizationMessage} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={errorFor(organizationErrors, 'business_name')}
            id="business_name"
            label="Business name *"
            onChange={(event) => setOrganization((current) => ({ ...current, business_name: event.target.value }))}
            required
            value={organization.business_name}
          />
          <Field
            error={errorFor(organizationErrors, 'hub_name')}
            id="hub_name"
            label="Operational hub name *"
            onChange={(event) => setOrganization((current) => ({ ...current, hub_name: event.target.value }))}
            required
            value={organization.hub_name}
          />
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white  disabled:cursor-not-allowed disabled:opacity-60"
          disabled={organizationSaving}
          type="submit"
        >
          <LuSave />
          {organizationSaving ? 'Saving…' : 'Save organization'}
        </button>
      </form>
    </section>
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div>
        <h3 className="font-semibold">Operational hub</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">This is the approved address for the sole operational hub/sorting center. Text relocation requires a separate review; this screen only corrects the pin on the same premises.</p>
      </div>
      {address ? <>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Address line</dt>
            <dd className="mt-1 font-medium">
              {[address.address_line_1, address.address_line_2].filter(Boolean).join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Barangay</dt>
            <dd className="mt-1 font-medium">
              {address.barangay || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">City / municipality</dt>
            <dd className="mt-1 font-medium">
              {address.city_municipality || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Province / region</dt>
            <dd className="mt-1 font-medium">
              {[address.province, address.region].filter(Boolean).join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Postal code</dt>
            <dd className="mt-1 font-medium">
              {address.postal_code || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Country</dt>
            <dd className="mt-1 font-medium">
              {address.country || '—'}
            </dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-white/10">
          <form className="space-y-4" onSubmit={(event) => void saveHubLocation(event)}>
            <div>
              <h4 className="font-semibold">Hub map pin</h4>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Review or correct the exact entrance. A reason is required and the server rejects stale edits.</p>
            </div>
            <HubLocationPicker
              address={hubAddress}
              apiKey={geoapifyApiKey}
              confirmed={hubLocationConfirmed}
              onInvalidate={() => setHubLocationConfirmed(false)}
              latitude={hubLocation?.latitude ?? null}
              longitude={hubLocation?.longitude ?? null}
              onChange={(coordinates) => { setHubLocation(coordinates); setHubLocationConfirmed(false); setHubLocationMessage(null); }}
              onConfirm={() => { setHubLocationConfirmed(true); setHubLocationMessage(null); }}
            />
            <label className="block text-sm font-medium" htmlFor="hub-location-reason">Reason for same-premises correction *
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--settings-focus)] focus:ring-2 focus:ring-transparent dark:border-white/15 dark:bg-[#171719]"
                id="hub-location-reason"
                maxLength={2000}
                onChange={(event) => setHubLocationReason(event.target.value)}
                placeholder="Example: corrected the pin to the loading entrance."
                required
                value={hubLocationReason}
              />
            </label>
            <AccountSettingsFeedback error={hubLocationError} message={hubLocationMessage} />

            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white  disabled:cursor-not-allowed disabled:opacity-60"
              disabled={hubLocationSaving || !hubLocation || !hubLocationConfirmed}
              type="submit"
            >
              <LuSave />
              {hubLocationSaving ? 'Saving…' : 'Save hub pin'}
            </button>
          </form>
        </div></> : <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">The approved hub address is unavailable. Contact an administrator before using Logistics operations.</p>}
    </section></>;
}
