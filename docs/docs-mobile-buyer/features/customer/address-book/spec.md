---
feature: address-book
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Address Book and defaults

## WHAT

Backend: Owned CRUD/defaults and checkout snapshots implemented; Dart assets/native pin integration
pending.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Addresses → cascading/manual form → optional pin → save/default → owned shipping selection.

- Requests use snake_case recipient/contact/address/locality/postal/country/type and optional label/line2/pair/is_default; DTO fields are camelCase. Type is shipping,billing,both and overlapping defaults clear transactionally through create/update, with no separate default route.
- Use the bundled unchanged PSGC JSON, Region→Province→City/Municipality→Barangay and manual fallback; npm packages are not Dart dependencies. Preserve supplied NCR/independent-city hierarchy.
- Intentional Geoapify pin clears stale pairs when text changes and never decides deliverability. Use optional flutter_map/latlong2/geolocator; suitable mobile public credentials remain a deployment gate; manual save stays usable. Confirm deletion. Address CRUD never reroutes a placed Order.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or communication
repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- Address Book lists all owned addresses without pagination; create/update return one Address, delete204
  has no JSON body.
- PATCH uses the complete create contract and is not an arbitrary partial address patch.
- Shipping/billing/both and is_default govern overlapping defaults transactionally; no set-default
  endpoint exists.
- Form maps snake_case requests to camelCase DTOs explicitly; never submit user_id or PSGC provider IDs.
- Copy the nineteen unchanged assets and load the index before lazy-loading a selected region.
- Nodes preserve code strings and geographic_level; provinces and direct city/municipality children are
  both real structures.
- Parent changes clear invalid descendants; Barangay list belongs only to the selected city/municipality.
- NCR contains direct cities and no Province node: keep required reviewed Province text and offer National Capital Region (NCR) as a compatibility suggestion.
- For direct cities elsewhere follow the reviewed source selector convention and preserve required manual
  Province entry when no real province exists.
- Codes remain local lookup state; saved API fields contain reviewed names. Postal code/street are
  manual.
- Unavailable/incomplete dataset keeps every text field editable and clearly offers manual fallback.
- Pin location makes one intentional Philippines-filtered Geoapify request; no lookup on typing/cascade
  changes.
- Show candidate and permit reviewed pin adjustment; save only finite valid coordinate pair after
  explicit confirmation.
- Changing location text clears stale coordinates; GPS choice never silently overwrites
  recipient/locality text.
- Use current location requests foreground permission once per deliberate action and allows denial/text
  fallback.
- Maps need approved public credentials/attribution; manual save works without provider configuration.
- Delete requires confirmation; address deletion/edit does not mutate any placed Order snapshot.
- Uncertain create rereads list before a deliberate resubmit; default updates refetch whole list to
  reflect cleared overlaps.
- Test all region paths/checksums, NCR cascade/manual Province text, parent resets and corrupted/missing
  asset fallback.
- Test paired/ranged coordinates, incomplete address, defaults overlap, foreign UUID denial and immutable
  Order address.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient authority.

- `GET /api/v1/customer/addresses` → HTTP 200; `{data:Address[]}`.
  Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/addresses` → HTTP 201; `{data:Address}`.
  Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `PATCH /api/v1/customer/addresses/{address}` → HTTP 200; `{data:Address}`.
  Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `DELETE /api/v1/customer/addresses/{address}` → HTTP 204; `No response body (204)`.
  Request: POST/PATCH complete fields: type shipping|billing|both; label nullable ≤80; recipient_name/address_line_1/barangay/city_municipality/province/region/country required strings≤255; contact_number≤32; postal_code≤10; address_line_2 nullable ≤255; coordinates nullable numeric pair latitude ±90/longitude ±180; is_default optional bool; user_id prohibited. GET/DELETE no body.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/address-book.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field is
required.
Named nested types and all child keys are defined in the local [wire tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not upstream
reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are ISO-8601
UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path validation.
Never default a missing required object/list to empty success. Unknown enum values disable unsupported
actions.

| DTO | Wire fields and types |
| --- | --- |
| `Address` | `id: UUID`, `type: string`, `label: string?`, `recipientName: string`, `contactNumber: string`, `addressLine1: string`, `addressLine2: string?`, `barangay: string`, `cityMunicipality: string`, `province: string`, `region: string`, `postalCode: string`, `country: string`, `latitude: coordinate?`, `longitude: coordinate?`, `isDefault: bool` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it signals
account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may be
absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay a
changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header is not
a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a mutation
rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in session
memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error on
either change.
Private data is memory-only by default; token is secure-store only, guest recency holds bounded public
hints only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `AddressRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `AddressListViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `AddressFormViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `PsgcLoader` owns safe platform access without widget HTTP calls; inject dependencies through
  AppDependencies.
- `PinViewModel` owns feature transitions, draft/query state and deliberate actions; inject dependencies
  through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward
  callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on screen/account
  loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID factory; widgets use
  injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not pretend there
  are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging failure has
  separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe input
  remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and preserves only
  supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed server
  response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline offers
  truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus never
  silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color status
  cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Cascade/manual/default/type/coordinate behavior works offline and across parent changes.
- [ ] Own CRUD and checkout selection preserve immutable Order snapshots; pin/GPS failure leaves text
  save usable.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve wire
  casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private
  credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle,
  offline and timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state or restart
  disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never globally
  retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard insets and
  Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures are not API
  acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open until owning
  evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in
[provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
