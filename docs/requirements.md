# Requirements

## Purpose
Defines **WHAT** the system must do, per role. This is scope, not implementation — see `architecture.md` for how, and `workflows.md` for step-by-step behavior.

## Customer

### Registration
Fields:
- Last name*
- First name*
- Middle initial
- Sex*
- E-mail*
- Contact No.*
- Birthday*
- Age (auto-generated from birthday)*
- Address — via API dropdown (Province, Municipality, Barangay) + manual entry (Street, House number, etc.)
- Upload ID

(* = required)

After submitting registration, the account is `pending` until an Admin approves it. Approval result is sent to the customer's email. Customer cannot log in until approved.

### Login
Standard login for approved accounts.

### Main Menu
- **Categories** — browse products by category
- **Search** — search bar; view product details; select item, choose quantity, choose variations (color, size, etc.), add to cart
- **View Cart** — select order(s), finalize order details, apply vouchers/discounts, choose mode of payment, place order
- **View Orders' Status** — order tracking states: to ship, in transit, out for delivery, plus rate/feedback after delivery
- **Chat/Messaging**
- **Account Management**
- **Logout**

## Seller
- Register as a seller
- Wait for Admin approval; get notified by email once approved
- Sign in
- Create/manage a store
- Add/manage products
- Manage incoming orders for their store

## Admin
- Log in
- View analytics/dashboard
- Approve or reject Seller applications
- Approve or reject Courier applications
- Handle customer service (support channel — specifics TBD)

## Courier (mobile-only)
- Register (as a general user first, per the flow)
- Log in
- Apply/register as a courier
- Wait for Admin approval
- Log in to courier features
- Manage assigned orders (pickup, delivery, status updates — specifics TBD)

## Non-functional / cross-cutting requirements
- Multi-tenant: each seller's store, products, and orders are isolated from other sellers.
- Role-based access control enforced server-side (API), not just hidden in the UI.
- Customer, Seller, and Courier accounts all require Admin approval before becoming active (not just Seller/Courier).
- Email notification required for Customer approval and Seller approval (Courier approval notification: TBD — confirm if email is also required).
- ID upload required at Customer registration — needs secure storage; visible to Admin for approval review.

## Open questions / TBD
Track unresolved requirement decisions here so nothing gets assumed silently while building:
- Payment methods/providers?
- Product catalog structure (categories, variants, attributes)?
- Order cancellation/refund policy?
- Courier order assignment logic (manual vs automatic)?
- Customer service channel (chat, ticket, email)?