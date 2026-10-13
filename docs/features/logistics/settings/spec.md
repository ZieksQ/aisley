# Logistics Settings

## Scope

The protected Logistics workspace provides Settings as a direct My account sidebar link. Settings uses a dedicated sidebar with Back to workspace, Account, Terms and conditions, Billing, and Appearance. Notifications is a direct sidebar link and Sign out remains in the persistent sidebar footer; operational navigation remains in the main workspace.

## Routes and existing workflows

- `/settings` redirects to `/settings/account`.
- `/settings/account` hosts existing [Account Management](../account-management/specs.md) workflows.
- `/settings/terms` hosts the existing [shared policy consent](../../shared/policy-viewing-consent/spec.md) screen, including both Terms of Service and Privacy Policy. It remains reachable when consent is required; other Settings pages retain the protected consent gate.
- `/settings/billing` hosts existing [Billing](../billing/spec.md). Payment settings and Courier cash remain Finance operations and are linked from Billing.
- `/settings/appearance` hosts a labeled Theme dropdown.
- Legacy `/account`, `/policy-consent`, and `/finance/billing` URLs redirect to their Settings destinations. Shipping rates remains an operational destination.

No API, approval, tenant ownership, financial permission, or policy acceptance contract changes.

## Appearance

- Options: System, Light, Dark. System is the default when no valid preference exists.
- System follows `prefers-color-scheme`, including device changes while the app is open.
- Explicit choices apply immediately and persist under the existing `logistics-theme` browser key. Existing Light/Dark values remain valid; storage failure leaves the choice usable for the current session.
- Apply the preference before rendering and across authentication and protected screens. Theme changes in another tab synchronize through storage events.
- Remove the prior binary theme buttons; Appearance owns the preference control.

## Experience and verification

Follow [the web design contract](../../../design.md) for appearance, responsive behavior, and supported themes. Preserve visible labels, keyboard focus, mobile navigation closure, and expanded/rail/drawer navigation behavior. Sidebar open/close controls expose expanded state; the mobile drawer contains focus and closes on Escape with trigger focus restoration. Account/group dropdowns are removed.

Verify the four Settings routes at narrow, intermediate and desktop widths; legacy redirects; required-consent access; device theme changes, explicit overrides and reload persistence; Account/Billing/Terms loading and failure feedback. Browser fixtures establish frontend behavior, not live API integration.
