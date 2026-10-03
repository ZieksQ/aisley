# Buyer shopping workflows

All Flutter flows are pending. [API guides](api/endpoints.md) define existing backend calls; [feature index](features/README.md) assigns ownership.

## Navigation

Use native bottom destinations **Home**, **Shops**, **Cart**, **Account**, with search reachable from discovery screens. This is the proposed Flutter navigation, not an existing implementation. Account links to Profile, Addresses, Orders, Wishlist, Recently Viewed, Notifications, Shop messages, Logistics messages, Courier messages, Support tickets, Settings/promotional preference, Policies/consent, and Logout. Distinct channels can share compatible rendering widgets while retaining separate repositories, routes, eligibility and read state.

Product/Shop/Order detail and forms open on the current navigation stack; Android Back and browser Back return predictably. Validate destination IDs and allow-listed return routes, including notification web-path mapping. A guest opening Cart/Account-private content sees sign-in and a safe return; the app requires an intentional retry of a protected mutation after sign-in.

## Registration, sign-in and access

Profile + credentials → pending Customer/Application (no token) → informational approval screen → Admin decision outside the app → login with `device_name` → securely stored Customer token → `/me` → consent status → required Terms/Privacy read and explicit acceptance → private shopping. Keep account-state denial distinct from invalid credentials and network/storage failure. There is no applicant status-polling API. Recovery requests are generic; emailed reset links currently target the storefront.

At cold start, keep public browsing usable and private state hidden while one controller restores the stored token through `/me`. Recheck required consent. On logout, revoke the current token when online and clear local private state. An uncertain revocation requires truthful feedback; account switching must still clear the old identity and reject delayed responses.

## Discovery and Product configuration

Home rails → Products/Shops search or Shop storefront → visible Product Detail → gallery, safe description, current price/availability → choose only a complete server-listed variant combination and bounded quantity → Add to Cart or Buy Now. Guest Recently Viewed records a successful Product Detail visit only, up to 12 `{productId, viewedAt}` hints; cards are resolved through the public visibility API. Authenticated history uses server time/retention. Merge guest hints after confirmed login without delaying authentication.

## Address and checkout

Address Book → Region → Province → City/Municipality → Barangay, manual street/postal fields → optional intentional Pin location → reviewed coordinates → save a shipping/both row. Parent changes clear invalid descendants; edited location text clears stale coordinates. Manual save survives data/provider/GPS failure.

Buy Now intent or selected Customer-owned Cart item IDs → saved shipping address + COD + optional voucher UUID/target Shop selections → quote → display each Shop's lines, shipping, savings and exact collectible total → explicit Place order → same reviewed intent + `quote_id` + UUID `Idempotency-Key` → atomic server transaction → CheckoutBatch and one Order per Shop → confirmation/Orders.

Changing items, address or vouchers requires a fresh quote. A stale quote requires review and another Place action. A timeout after placement is uncertain: retain the exact key/payload and retry/reconcile; do not generate a second key or assume failure. The batch API needs a known batch UUID, so it is not an arbitrary lookup by idempotency key. Purchased selected Cart lines are removed after commit; Buy Now leaves the Cart unchanged.

## Order lifecycle and permitted corrections

| Buyer tab | Canonical server statuses |
| --- | --- |
| To Pay | `pending_payment` (future online-payment path) |
| To Prepare | `placed`, `seller_processing`, `ready_for_pickup` |
| To Ship | `picked_up`, `assigned`, `in_transit` |
| Out for Delivery | `out_for_delivery` |
| Completed | `delivered` |
| Cancelled / Issue | `cancelled`, `rejected`, `delivery_failed`, `return_requested`, `returned` |

COD begins `placed`/pending payment. Seller acceptance starts processing; prepared pickup freezes a shared waybill; accepted first-mile Courier confirms Seller handoff; Logistics receives/sorts/transfers/dispatches; accepted final-mile Courier performs delivery evidence/intent; Logistics validates and commits authoritative completion. Buyer reads safe projections only. An Order's `assigned` Courier display alone does not authorize Courier chat.

While the server permits an owned `placed` Order, Customer can confirm cancellation with optional reason or correct its delivery address using an owned shipping/both row. Each write has a UUID key; modification may carry the expected revision. Seller processing closes this window. Correction produces a new immutable snapshot version and must preserve financial/serviceability rules; current shipping-rate/coverage revalidation is a recorded backend gap (G21), requiring owner review for material-location changes. Changes to Address Book never reroute an Order automatically. Item, quantity, voucher, repricing, return and refund changes remain deferred.

## Communication and after delivery

Shop/Product/owned Order → Shop composer → first committed message creates/reuses one Customer–Shop thread. Active owned Order → Logistics composer with Order context → server resolves current handling organization/hub. Owned Order → private Courier Order-context read → accepted-final-mile eligibility → first message creates the task-specific Courier thread. Ended/reassigned relationships keep only authorized read-only history; replacement participants never inherit private transcripts.

Polling while visible/online, ordered cursor history and monotonic reads provide foreground messaging. Freeze uncertain text/key for exact retry; no offline-send queue. Support-ticket create/reply uses its own keys and revision rules. Notifications link to allowed screens but cannot advance any business status.

Delivered owned Order Item → server review capability → rating/plain-text review → canonical Review result → up to configured photo limit via separate uploads. Review creation replays identical content by Order Item; image uploads have no replay guarantee. Reconcile each uncertain image response before uploading another copy. Seller official review response is read-only. Q&A remains public Product knowledge and does not require a delivered purchase.
