---
model: Buyer
type: Domain Context
purpose: Shared Customer/Buyer workflow and implementation context
version: 1.1
status: Revised — aligned with the implemented Customer storefront and first-party order flow
---

# Buyer Model Context

## Overview

Buyer is Aisley's marketplace customer role. **Customer** is the canonical API and authorization term (`customer`); Buyer is the product and documentation term used for the person purchasing from a Shop. The Customer experience lives in the separate Next.js storefront at `src/webapp`; Laravel and PostgreSQL remain authoritative for identity, catalog visibility, cart, checkout, orders, and personal data.

Guests may browse public storefront content. An active, approved Customer is required for account data, Cart, Wishlist, Recently Viewed synchronization, checkout, order history, and other protected actions. The Buyer app never decides ownership, price, stock, eligibility, or fulfillment status from client-provided values.

Aisley uses its first-party Logistics organization and sole operational hub for fulfillment. Customer tracking consumes safe read-only projections of the shared Order and future Shipment/Delivery Task contracts; it is not a third-party-carrier or customer-controlled status flow.

## Account and access boundary

- Customer registration, approval, authentication, and password recovery follow `docs/references/user-registration-requirements.md` and the Customer Auth feature contracts.
- A Customer registers and waits for the required Admin approval before sign-in and protected access. Pending, rejected, suspended, deactivated, unauthenticated, or non-Customer identities receive no Customer data.
- The API derives the authenticated Customer from Sanctum session/token context and normalized `email + role`. Clients cannot submit a replacement `user_id`, role, approval state, age, or account status.
- Age is calculated server-side from the stored `birth_date`; a client-supplied age is never authoritative.
- Customer account/profile data is allow-listed and Customer-scoped. Profile photos use the configured private disk/Azure Blob path and the shared upload policy; raw object paths and credentials are never returned.
- Guests can be sent to sign-in with a same-origin return path for protected pages, then must intentionally retry the protected action after authentication.

The Customer storefront uses the existing stateful Sanctum cookie flow. Any future external/mobile Customer client must use the documented bearer-token contract and the same role/status gates; no UI or API may bypass those gates.

## Public storefront and visibility contract

The public discovery chain is:

```text
public request
→ active approved Seller
→ active Shop not on vacation
→ published active Product
→ approved Product media and safe Product-card/detail projection
```

- Guests and Customers may browse the public homepage, search, Product Detail, Shop directory, and Shop storefront.
- `Product::storefrontVisible()` is the shared visibility boundary. Draft, archived, deleted, hidden, compliance-restricted, inactive-Seller, inactive-Shop, suspended-Shop, and vacation-Shop listings are excluded from public responses.
- Storefront visibility is distinct from purchasability: Cart and Checkout recheck current Variant, SKU, stock, Shop, price, voucher, and address eligibility at the point of mutation.
- Public DTOs contain only safe catalog, Shop, media, and pricing presentation fields. They do not expose Seller registration evidence, Admin data, Customer data, private notes, payment secrets, or raw storage paths.
- A public or ISR/shared cache must never contain Customer-specific Wishlist, Recently Viewed, address, Cart, order, or account data.

## Canonical order and fulfillment contract

Persisted and API status values use lowercase `snake_case`. PHP enum case names and UI labels are separate from database values. The current high-level `OrderStatus` contract is:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ assigned
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

Exceptional values are `cancelled`, `rejected`, `delivery_failed`, `return_requested`, and `returned`.

COD placement currently creates an Order at `placed` with `payment_status = pending`; `pending_payment` remains an available shared status for a future payment-state decision. `assigned` means Logistics received and accepted the Seller-ready parcel at its sole hub. `picked_up` means the final-mile Courier took the parcel from that hub. A Customer can read these states but cannot advance or rewrite them.

The physical flow is:

```text
Customer places Order (`placed`)
→ Seller processes and confirms `ready_for_pickup`
→ first-mile Courier accepts and picks up from Seller
→ Logistics receives, sorts, transfers, and dispatches at its sole hub
→ Logistics assigns a final-mile Courier
→ final-mile Courier picks up from hub and delivers to Customer
→ Order becomes `delivered`
→ Customer may review an eligible delivered Product
```

Detailed physical milestones belong to Shipment/Delivery Task records, not to invented `orders.status` values:

```text
seller_pickup_assigned
→ seller_pickup_accepted
→ picked_up_from_seller
→ received_at_hub
→ sorted_at_hub
→ in_transfer
→ dispatched_from_hub
→ delivery_assigned
→ delivery_accepted
→ picked_up_from_hub
→ in_transit
→ out_for_delivery
→ delivered
```

First-mile and final-mile assignments are independent. Completing Seller pickup does not automatically grant final-mile assignment; Logistics may assign the same or a different eligible Courier. The Customer receives only safe, chronological events and authorized tracking projections.

## Buyer capabilities

### 1. Customer Authentication and Account

- **Purpose:** Register, wait for approval, sign in, recover credentials, and maintain the Customer profile.
- **Current state:** Customer Auth, approval-aware sessions, password recovery, account profile/password management, and private Customer profile photos are implemented.
- **Boundary:** Account settings cannot change role, approval/status, another user's record, registration evidence, order snapshots, or authoritative catalog values.

### 2. Homepage, Search, and Discovery

- **Purpose:** Help guests and Customers find public Products, Shops, categories, campaigns, and deals.
- **Current state:** Public homepage aggregation, bounded Product/Shop/category search, safe Product cards, responsive storefront sections, and authenticated context are implemented.
- **Boundary:** Search and homepage are read projections. They do not create Recently Viewed entries, reserve stock, add Wishlist rows, or promise a price/availability that Checkout has not revalidated.

### 3. Product Detail

- **Purpose:** Show one currently visible Product, its Shop, media, specifications, Markdown description, valid option combinations, price, and stock state.
- **Current state:** UUID Product Detail routing, ordered gallery/variant media, safe GFM Markdown rendering, variant selection, quantity limits, Add to Cart, and Buy Now intents are implemented.
- **Boundary:** Product description images are Product-owned approved assets; the Customer renderer uses safe Markdown/GFM and does not execute raw HTML or arbitrary external image paths. Product Detail does not itself place an Order.

### 4. Browse Shops

- **Purpose:** Let guests and Customers open the public Shop directory and a Shop by slug, then filter that Shop's visible Products by the canonical Product Category taxonomy.
- **Current state:** Paginated directory, Shop-scoped category filtering, deterministic Product pagination, safe Shop summaries, metadata, and accessible loading/empty/not-found/retry states are implemented.
- **Boundary:** A Shop page can return only Products belonging to the resolved active Shop and never bypasses `storefrontVisible()`.

### 5. Cart

- **Purpose:** Hold Customer-selected Product/SKU configurations before checkout.
- **Current state:** One UUID Cart per active Customer, SKU/Variant-level line identity, authenticated add/update/delete, current price/availability projections, selected-line checkout, and unavailable-intent preservation are implemented.
- **Boundary:** Cart contents are not an inventory reservation and do not snapshot authoritative price, stock, shipping, or totals. Every mutation revalidates Product, Variant, Shop, and quantity ownership.

### 6. Checkout and Order Creation

- **Purpose:** Convert Buy Now or selected Cart intent into one or more valid Shop Orders.
- **Current state:** Server-authoritative quote/place APIs and storefront flow are implemented for COD. Lines are grouped by Shop; one Shop group creates one Order, while a multi-Shop submission is one atomic checkout batch with separate Orders.
- **Rules:** The Customer selects a Customer-owned address, the API rechecks catalog/inventory/vouchers and creates immutable item, financial, payment, and delivery-address snapshots. Placement uses a Customer-scoped idempotency key and does not accept client prices, totals, status, ownership, or payment secrets.
- **Boundary:** Payment gateways, returns/refunds, Seller preparation, Shipment/Delivery Task persistence, and Logistics/Courier assignment are separate features.

### 7. Order History and Status Monitoring

- **Purpose:** Let an authenticated Customer view their own purchase history, status tabs, Order details, immutable snapshots, and safe tracking timeline.
- **Current state:** `/orders` and `/orders/{order}` APIs/pages are implemented with **All** as the default list, server-side status-group filters, pagination, chronological status events, private no-store responses, and ownership-safe not-found behavior.
- **Rules:** The status mapper is server-owned. Tracking is read-only; a Customer cannot cancel by changing a status or submit a Courier/Logistics update. Detailed hub/task milestones and any active map data are consumed only when the owning Logistics contracts provide them.
- **Boundary:** Customer views omit private Courier GPS history, employee IDs, full hub addresses, internal notes, payment credentials, and Admin/Seller operational data. Map/provider failure leaves the timeline intact and never fabricates an ETA or location.

### 8. Address Book and Delivery Location

- **Purpose:** Save reusable shipping/billing addresses and select one during checkout.
- **Current state:** Customer-scoped address list/create/edit/delete/default/checkout-selection flows are implemented.
- **Location flow:** Philippine Region → Province → City/Municipality → Barangay options come from the bundled `@aisley/psgc-address-data` package. The Customer may use a Philippines-scoped Geoapify forward-geocoding request after selecting **Pin location**, then refine a local draggable pin on Leaflet-rendered Geoapify tiles; manual entry remains available when a provider or map is unavailable.
- **Rules:** Coordinates are optional mutable Address Book data. Checkout validates the selected Customer-owned address and copies normalized fields/coordinates into an immutable `order_addresses` snapshot. Editing or deleting the saved address cannot rewrite a placed Order.
- **Boundary:** The Buyer address flow does not choose a Logistics hub, calculate courier routes, or expose another Customer's address.

### 9. Order Modification and Cancellation

- **Purpose:** Allow limited correction or cancellation of a newly placed Order.
- **Contract:** Eligibility is server-calculated and must be rechecked under the shared Order transition rules. The current MVP boundary allows changes only while the Order remains `placed`, before Seller processing begins; `seller_processing`, `ready_for_pickup`, and every downstream state close the normal modification window.
- **Boundary:** This feature does not mutate immutable item/price/payment history or alter an Order's Address Book source record. A later approved policy may add specific actions without granting generic Customer status control.

### 10. Wishlist

- **Purpose:** Save or remove currently buyer-visible Products for later.
- **Current state:** Phase 1 Customer-scoped save/remove/list/status APIs and Product Card/Detail controls are implemented, with a protected `/account/wishlist` page and Cart handoff.
- **Rules:** Wishlist is not Cart, reservation, price guarantee, public list, or Seller analytics. Hidden or restricted Products are omitted and Cart revalidates current state. Guest clicks redirect to sign-in and are not silently persisted.
- **Deferred:** Restock/price-drop alerts require a separate Customer notification inbox, preferences, durable deduplication, and delivery contract; no alert is claimed yet.

### 11. Recently Viewed Items

- **Purpose:** Help a Customer or guest find Products whose canonical Product Detail page they opened.
- **Current state:** Product-detail-only recording, bounded guest local history, non-blocking login/session merge, Customer-scoped persistent history, visibility filtering, homepage rail, and protected Account history page are implemented.
- **Rules:** A Product is recorded once per valid detail visit; cards, searches, rails, hovers, and variant changes do not create entries. Guest storage contains only bounded Product IDs/timestamps and remains best effort when browser storage fails. Authenticated history is private and never shared-cached.

### 12. Reviews and Ratings

- **Purpose:** Let a Customer rate and describe a purchased Product after delivery, optionally with approved media.
- **Status:** The requirement and feature boundary exist, but review persistence, verified-purchase enforcement, moderation, and Customer media submission are deferred from the current implemented foundation.
- **Rules when implemented:** Only the purchasing Customer may review an eligible delivered line; review media must follow `docs/references/file-upload-requirements.md`; Seller replies and moderation remain separate concerns.

### 13. Product Q&A and Chat/Messaging

- **Purpose:** Ask public Product questions and communicate with an authorized Seller or support participant.
- **Status:** These are documented/deferred capabilities, not current Customer storefront implementations.
- **Boundary:** Future threads, questions, notifications, and unread counts must be Customer/Shop or relationship scoped. They must not expose registration evidence, private addresses, payment secrets, or unrelated users, and must not duplicate the order-status or Admin notification contracts.

## Data, privacy, and consistency invariants

- Every protected Customer query derives ownership from the authenticated Customer and applies the correct role/status middleware. Forged IDs, cross-role same-email records, and another Customer's UUIDs return an ownership-safe denial.
- `storefrontVisible()` is applied to every public Product projection and again at Wishlist, Recently Viewed, Cart, and Checkout boundaries. Public cache entries contain no Customer-specific state.
- Cart and Checkout use server prices, voucher eligibility, address validation, and inventory locks. Order placement is atomic and idempotent: failed validation creates no partial Orders, reservations, voucher redemption, or notifications.
- Placed Order items, money, payment method/status, delivery address, and voucher data are immutable snapshots. Mutable Address Book, Product, Shop, or Seller changes cannot rewrite historical Orders.
- Order status transitions and status events are owned by the relevant Seller, Logistics, or Courier contract and are validated, transactional, idempotent, and append-only. Notification or map delivery failure cannot roll back a committed business decision.
- Customer-specific APIs and pages use private/no-store semantics where required. Logs and DTOs omit tokens, password hashes, full addresses, raw GPS history, private media paths, and payment credentials.
- File/image work follows `docs/references/file-upload-requirements.md`: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, with server-side signature, MIME, decode, ownership, and private-delivery checks. Profile-photo storage is configured-disk/Azure Blob; Product description/gallery assets are separate Product-owned records.

## Current and deferred data boundary

Implemented Customer foundation:

- Customer registration/authentication, Admin approval gating, session restoration/logout, password recovery, account profile/password management, and private profile photos.
- Public homepage/search, Product Detail, Browse Shop, shared visibility filtering, catalog media/Markdown projections, Cart, COD checkout, vouchers, inventory reservation, Shop Orders, immutable snapshots, and Customer order-status monitoring.
- Customer Address Book with bundled PSGC options, Geoapify pin assistance, Leaflet/Geoapify map rendering, manual fallback, order-address snapshots, Wishlist Phase 1, and Recently Viewed history.

Deferred or dependent Customer operations:

- Seller order preparation, first-mile pickup, Logistics hub processing, Shipment/Delivery Task records, final-mile assignment, Courier delivery, proof of delivery, route/ETA display, payment gateways, returns/refunds, reviews, Product Q&A, Chat/Messaging, Customer notification preferences/inbox, and Wishlist alerts.

Future Customer-facing shipment fields must be provider-neutral, safe, and read-only. Future enum-like database fields remain string-backed and API-cast to PHP enums; fulfillment additions must preserve the shared high-level `OrderStatus` contract and explicit Shipment/Delivery Task milestones.

## Shared contracts

- `docs/requirements.md` — Buyer responsibilities, approval boundary, address/order requirements, and first-party fulfillment flow.
- `docs/workspace.md` — Customer journeys, canonical Order status meanings, and the sole-hub Logistics flow.
- `docs/schema.md` — Users, addresses, catalog, Cart, checkout, Order snapshots/status history, and deferred fulfillment schema boundary.
- `docs/references/user-registration-requirements.md` — Customer registration and approval requirements.
- `docs/references/file-upload-requirements.md` — Profile, Product, and future Customer media upload rules.
- `docs/features/customer/*/spec.md` — Feature-specific Customer implementation contracts.
