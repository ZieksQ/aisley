# Admin Settings

## Workspace and routes

- Settings replaces Account settings and Policy consent in the main sidebar. Its dedicated sidebar follows Logistics: Back to workspace, Account, Terms and conditions, Billing, Appearance, and Notifications. Sign out remains in the persistent footer.
- `/settings` redirects to `/settings/account`. Account retains existing profile, security and role-specific sections, query selection, ordinary drafts and sensitive-state disposal.
- `/settings/terms` hosts shared Terms/Privacy reading and consent. Both it and legacy `/policy-consent` remain reachable when acceptance is required; other Settings pages retain the consent gate. Preserve safe return navigation after acceptance.
- `/settings/billing` is an entry page linking to existing Finance automation at `/finance/automation`. Financial operations remain in Finance; no new billing API or financial feature is introduced.
- `/settings/appearance` owns the portal Theme dropdown. Remove the dashboard theme toggle; authentication-screen toggles use the same state.
- Legacy `/account` and `/policy-consent` redirect to their Settings destinations, preserving search, hash and return-navigation state.
- Require `finance.view` for Billing navigation and direct route access; retain `finance.manage` for existing writes. Notifications requires `notifications.view`. Admin setup/email verification continues to take priority; personal Settings does not replace Platform settings.

## Appearance and presentation

Follow [the design contract](../../../design.md), with purple actions/selection and existing typography. Reuse Settings navigation and Appearance presentation from `@aisley/ui/portal`; role routes, clients and authorization remain app-owned.

- Theme options: System, Light, Dark. Default to System when no valid value exists. Preserve existing `aisley-admin-theme` Light/Dark values.
- Apply before rendering and immediately on changes; follow device theme while System is selected and synchronize browser storage changes across tabs. Storage failure retains the current-session selection.
- Preserve keyboard focus, visible labels, reduced motion and expanded/rail/mobile drawer behavior. Mobile navigation closes on selection; Escape restores focus to its trigger.

## Verification

Check all Settings routes at 390/768/1440px in light/dark themes, legacy/query/history behavior, Account loading/retry/drafts, policy gate/acceptance, Billing destinations and permissions, theme initialization/system changes/persistence/storage failure and drawer keyboard behavior. Browser fixtures establish frontend behavior only.
