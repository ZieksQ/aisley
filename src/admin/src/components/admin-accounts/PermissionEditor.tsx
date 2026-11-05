import type { PermissionDefinition } from '../../types/adminAccounts'

function withReadDependencies(slugs: string[], catalog: PermissionDefinition[]) {
  const result = new Set(slugs)
  for (const slug of slugs) {
    const read = `${slug.slice(0, slug.lastIndexOf('.'))}.view`
    if (catalog.some((permission) => permission.slug === read)) result.add(read)
  }
  return [...result].sort()
}

export function PermissionEditor({
  catalog,
  selected,
  inherited = [],
  grantable,
  onChange,
  disabled = false,
}: {
  catalog: PermissionDefinition[]
  selected: string[]
  inherited?: string[]
  grantable: string[]
  onChange: (permissions: string[]) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-3 font-semibold">Individual permissions</legend>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Role permissions are inherited. Selecting an action also selects its required view
        permission.
      </p>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {catalog.map((permission) => {
          const fromRole = inherited.includes(permission.slug)
          const needed = selected.some(
            (slug) =>
              slug !== permission.slug &&
              `${slug.slice(0, slug.lastIndexOf('.'))}.view` === permission.slug,
          )
          return (
            <label className="flex min-h-11 items-start gap-3 py-2 text-sm" key={permission.slug}>
              <input
                className="mt-1 size-4 shrink-0 accent-[#4C1268]"
                type="checkbox"
                checked={selected.includes(permission.slug) || fromRole}
                disabled={disabled || fromRole || needed || !grantable.includes(permission.slug)}
                onChange={(event) =>
                  onChange(
                    withReadDependencies(
                      event.target.checked
                        ? [...selected, permission.slug]
                        : selected.filter((slug) => slug !== permission.slug),
                      catalog,
                    ),
                  )
                }
              />
              <span>
                <span className="font-medium">
                  {permission.name}
                  {fromRole ? ' (from role)' : needed ? ' (required)' : ''}
                </span>
                <span className="block text-slate-600 dark:text-slate-300">
                  {permission.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
