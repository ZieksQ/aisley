import { date, titleCase } from './model'
import type { Terms } from './types'

function difference(value: Terms[keyof Terms], key: string) {
  if (key === 'starts_at' || key === 'ends_at') return date(String(value))
  if (typeof value === 'object') return JSON.stringify(value)
  return value === null ? 'Unlimited / none' : String(value)
}
export function DraftDifferences({
  published,
  draft: draftTerms,
}: {
  published: Terms
  draft: Terms
}) {
  const changes = (Object.keys(draftTerms) as (keyof Terms)[]).filter(
    (key) => JSON.stringify(draftTerms[key]) !== JSON.stringify(published[key]),
  )
  return (
    <section>
      <h2>Pending draft differences</h2>
      {changes.length === 0 ? (
        <p>No term differences.</p>
      ) : (
        <div
          className="voucher-table"
          role="region"
          tabIndex={0}
          aria-label="Draft differences"
        >
          <table className="voucher-diff">
            <caption>Changes take effect on publication</caption>
            <thead>
              <tr>
                <th scope="col">Term</th>
                <th scope="col">Published</th>
                <th scope="col">Draft</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((key) => (
                <tr key={key}>
                  <th scope="row">{titleCase(key.replaceAll('_', ' '))}</th>
                  <td>{difference(published[key], key)}</td>
                  <td>{difference(draftTerms[key], key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
