# Workflows

## Purpose
Defines **HOW** the system behaves: step-by-step flows and state transitions per role.

## Customer flow
Register (with ID upload) → Admin Approval → Email (approval notification) → Sign in → Browse Product → See Product → Add to Cart → Checkout → Order

Customer state: `pending` → `approved` (or `rejected`), set by Admin. Only `approved` customers can log in.

## Seller flow
Register as a seller → Admin Approval → Email (approval notification) → Sign in → Create Store → Add Products → Manage Orders

Seller state: `pending` → `approved` (or `rejected`), set by Admin. Only `approved` sellers can sign in to seller dashboard features.

## Admin flow
Login → Analytics → Approve Sellers and Couriers → Customer Service

## Courier flow (mobile-only)
Register → Login → Register as a Courier → Admin Approval → Login → Manage Orders

Courier state: `pending` → `approved` (or `rejected`), set by Admin. A user can exist as a general registered user before applying to become a courier; courier-specific features unlock only after admin approval.

## Notes
- Approval steps for Customer, Seller, and Courier are gates, not the end of the flow — the account exists in a "pending" state and must not be able to log in or access role-specific screens/endpoints until approved.
- Order status lifecycle (customer-visible, from `requirements.md`): to ship → in transit → out for delivery → delivered (then rate/feedback). (TBD) Full backend lifecycle including placed/confirmed/cancelled states, and who can trigger each transition (customer, seller, courier, admin), is not yet defined.