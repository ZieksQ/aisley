# Design System

## Scope and authority

This is the shared web design contract for `src/webapp` (Customer), `src/admin`, `src/seller`, and `src/logistics`, including reusable UI consumed by these applications. Read and follow it for frontend implementation and revisions.

- Feature specs define the feature's workflow, content, permissions, and navigation destinations. Their UI must follow this guide; older mockups and template READMEs do not establish competing design rules.
- Reuse each app's established layout and theme implementation. This contract requires consistency within the shared brand while preserving the Customer storefront and dashboard roles.
- An explicit design change must update this guide and any affected web guidance together. Describe existing inconsistencies truthfully rather than treating this document as proof that every screen already complies.
- `src/couriermockup`, the external Courier Flutter app, Courier specifications, and copied Flutter documentation are outside this contract's scope.

## Colors

- **Primary:** `#E6007A`
- **Secondary:** `#4C1268`
- **Error:** `#FF3B30`
- **Warning:** `#FF8800`
- Use additional contextual colors when they improve usability, accessibility, or meaning.

## Color Ratio

Use the **60/30/10 rule** as a visual balance, not a literal pixel quota:

- **60%:** White / dark neutral backgrounds and surfaces
- **30%:** Secondary/supporting colors, borders, muted surfaces, typography
- **10%:** Primary and contextual accent colors

Avoid overusing the primary pink. It should guide attention rather than dominate the entire UI.

## Applications

### `src/webapp/`

Customer-facing e-commerce experience inspired by platforms such as Shopee, Amazon:

- Light mode only, including authentication, account, checkout, and shared feature screens rendered in the storefront
- Clean, modern, highly visual interface
- Product images and pricing are prominent
- Strong search, category, cart, and checkout UX
- Use cards, badges, filters, and clear calls-to-action
- Optimize for responsive/mobile layouts

### `src/admin/`, `src/seller/`, `src/logistics/`

Professional dashboard experience:

- Support both light and dark modes through each dashboard's existing theme control; dark mode is not the only supported appearance
- Clean and information-dense without feeling cluttered
- Sidebar navigation with clear active states
- Dashboard cards, tables, filters, forms, charts, and status badges
- Prioritize readability and efficient workflows
- Use contextual colors for statuses, warnings, and errors
- Keep Dashboard directly accessible and preserve the role's established sidebar groups, permission-filtered links, active-route expansion, and mobile close behavior. The matching Dashboard spec owns the exact groups and destinations.

## Mobile-first responsive behavior

- Implement the smallest supported viewport first, then enhance the same workflow for tablet and desktop using the app's existing responsive conventions.
- Keep labels, actions, validation messages, navigation, and dialogs usable without page-wide horizontal scrolling. Long references and user content must wrap or truncate accessibly.
- Dense tables may use a labeled, contained horizontal scroll region or a readable narrow-screen presentation. Essential actions must remain reachable.
- Use viewport-bounded dialogs and menus, allowing their content to scroll when needed. Preserve visible controls and focus when a mobile keyboard is open.
- Admin commission policy creation and publication confirmation use centered, viewport-bounded modals with focus containment, Escape/cancel, focus restoration, and unsaved-input discard confirmation. Policy history actions use visible bordered buttons; sortable headers expose their direction and pagination shows at most ten rows.
- A desktop layout alone is not completion. Check narrow, intermediate, and wide layouts, including the affected light/dark states for dashboards.
- Admin Pricing & fees uses a compact Philippine vector selector: limit its map viewport to 300–360px tall and 360px wide, provide zoom/reset and accessible panning, and keep the conventional region dropdown alongside the same surcharge workflow.

## Components

Use compatible workspace packages under `packages/` for shared presentation. `@aisley/ui` currently provides Button, TextField, and SelectField primitives; inspect their exports before assuming another component exists. Shared feature packages such as Finance and Support Tickets must also respect the consuming app's theme and layout.

Prefer consistent shared components for:

- Buttons
- Inputs and forms
- Cards
- Tables
- Modals
- Badges/status indicators
- Navigation
- Typography
- Loading and empty states etc.

Avoid creating duplicate components when an appropriate shared component already exists.

- Keep feature-specific composition inside its owning app; share a component when it has compatible consumers and a clear responsibility.
- Shared visual components must not carry another role's navigation, authorization, or private data assumptions.
- Reuse established app typography, spacing, radius, and theme-aware styles. New colors or variants need a clear semantic purpose and must work in the consuming app's supported themes.

## UX and Jakob's Law

Users bring expectations from other applications. Familiar interaction patterns help them understand AISLEY without learning a new interface for each feature.

- Messaging presentation follows the [shared Chat Messaging UI/UX specification](features/shared/chat-messaging/spec.md) alongside this guide. It governs web inboxes, threads, commerce context, and proposed media interactions; role specs retain authorization/workflow ownership, and proposed capabilities do not change current text-only API contracts.

- Prefer established e-commerce conventions for navigation, search, filters, forms, checkout, messaging, and account settings. Reuse the app's existing patterns and compatible shared components rather than inventing new controls for familiar tasks.
- Keep terminology, action labels, status meanings, and similar interactions consistent within each app. Share compatible presentation patterns across web apps without mixing role-specific screens, navigation, or authorization.
- Make the primary action and next step clear. Group secondary actions, use concise labels, and show workflow progress when relevant; do not hide required choices or confirmations to simplify a screen.
- Give prompt loading, success, validation, and error feedback. Explain how to recover instead of showing generic failures or treating an uncertain mutation as successful; retry according to the owning API contract.
- Preserve safe form input after recoverable failures and show actionable field-level validation. Never retain passwords, private evidence, or account-scoped drafts beyond their approved lifecycle; clear private state on logout or authorization loss.
- Make back/cancel behavior predictable. Do not silently discard unsaved changes; confirm destructive actions with their consequences and a clear cancel path. Keep controls keyboard-accessible and feedback understandable without color alone.
- Introduce an unfamiliar interaction only when it solves a specific user problem; document the reason and verify the affected workflow's usability. Familiarity must never override accessibility, privacy, authorization, or required business rules.

## General Rules

- Maintain consistent spacing, typography, radius, and component behavior.
- Apply the mobile-first responsive behavior above to every new or changed web feature.
- Use color for hierarchy and meaning, not decoration alone.
- Maintain sufficient contrast and accessible focus/hover states.
- Keep customer UI and professional dashboards visually distinct while sharing the same design system.
- Favor simple, polished interfaces over unnecessary visual complexity.
- Give icon-only actions accessible names, keep forms visibly labeled, and make navigation/dialog controls keyboard-operable with visible focus and appropriate expanded states.
- Provide loading, empty, validation, error, disabled, and success states where the workflow needs them. Do not present failed requests as successful empty results or use color as the only status cue.

## Finance workflow pages

- The COD invoice, remittance, payout, automation/settings, and sandbox pages use the same centered 1280px content width, aligned page/navigation gutters, 24px page titles, and 14px body text. Preserve role-owned navigation and the existing dashboard shell.
- Use a single page header with concise purpose text and grouped secondary actions. Navigation and view selectors use simple underline indicators, accessible current/pressed states, and contained horizontal scrolling on narrow screens. Reserve filled buttons for the next workflow action.
- Show financial totals as a compact definition list rather than a decorative metric-card grid. Place selected order/invoice counts, beneficiary information, and totals beside the payment action. State waiting-period overrides and simulated-money status where they affect decisions.
- Use compatible `@aisley/ui` fields/buttons with Finance-scoped theme styling. Labels sit above equally sized controls; filters align at their bottom edge. Group settings by COD collection, Seller payouts, and Logistics payouts. Preserve readable disabled states and plain labeled checkboxes.
- Tables have captions and scoped column headers, tabular right-aligned amounts, readable references, and text status labels. Contain overflow within a focusable labeled table region; keep primary actions outside the table. Empty/error/loading states remain distinguishable.
- Detail screens group references, amounts, dates, allocations, and attempts into predictable sections. Sandbox account editing is shown on demand; payment diagnostics and raw event payloads use disclosure controls.
- These choices apply [NN/g's consistency, feedback, and error-prevention heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [GOV.UK button hierarchy](https://design-system.service.gov.uk/components/button/) and [table guidance](https://design-system.service.gov.uk/components/table/), and [W3C's semantic table guidance](https://www.w3.org/WAI/tutorials/tables/). Keep the AISLEY palette and role workflows authoritative rather than copying those sites' visual branding.

## Logistics Sort plan workspace

- Use compact bordered lists and tables, the existing neutral surfaces and AISLEY palette, readable light/dark controls and visible keyboard focus. Keep the plan list on the right at desktop widths and before the editor on narrow screens.
- Give each plan a vertical three-dot actions menu; use a copy icon with Duplicate plan text and a centered confirmation modal. Duplication has no name input; the server assigns the next numbered name.
- Browse/search published versions in a separate viewport-bounded modal, with a visible version list and selected snapshot actions. Keep plan search within the plan list.
- Show preserved destinations and mapping differences directly in tables or sections. Do not hide this content in dropdowns, disclosure controls or accordions. Contain table overflow and modal scrolling.
- Success messages have an accessible X button and dismiss after five seconds. Keep actionable errors and uncertain-request verification visible until resolved. This rule applies to the Sort plan workspace and its version/copy actions.

## Logistics Settings and Support tickets

- Settings is reached from the sidebar account popup and replaces operational navigation with its own solid sidebar: Back to workspace, Account, Terms and conditions, Billing, Appearance. Keep operational Finance payment settings separate. The [Settings specification](features/logistics/settings/spec.md) owns routes and legacy redirects.
- Appearance uses one labeled dropdown: System (default), Light, Dark. System responds to device changes; explicit preferences persist for this browser. Apply the theme across authentication and protected screens.
- Logistics Support tickets uses a compact request list with subject, reference, status, update date and functional unread counts; select a ticket to read its plain-text conversation and reply. New ticket opens the creation form on demand. At narrow widths, show the list or content with an All tickets back action, rather than stacking the full list above the conversation.
- Use the existing neutral surfaces and brand palette, ordinary headings and 6–8px control/container radii, simple borders, visible focus and restrained shadows. Keep loading, failed reads, empty tickets and failed mutations distinct. Confirm discarding drafts and retain exact uncertain retry payloads.
- All Logistics date/time fields, including Finance collection time and sort-plan activation, use the installed Flatpickr wrapper with theme-aware styling. The newly converted Finance/activation fields allow keyboard entry and retain browser required-field validation. Preserve each field's API format and Asia/Manila schedule semantics.
- Research references: [Linear preferences](https://linear.app/docs/account-preferences) for the explicit/system theme choice; [Zendesk request tracking](https://support.zendesk.com/hc/en-us/articles/4408846805530-Submitting-and-tracking-requests-in-the-help-center-Customer-Portal) for request metadata and conversation follow-up; [Flatpickr options](https://flatpickr.js.org/options/) for date/time and time-only picker configuration. These inform interaction patterns; Aisley workflows and palette remain authoritative.

## Next.js SEO, SSR, and CSR

These rendering rules apply to the Customer Next.js storefront; the Admin, Seller, and Logistics React Router dashboards retain their existing SPA architecture.

- Prefer SSR, SSG, or ISR for public, indexable content so meaningful page content and metadata are present in the initial HTML.
- Give each indexable route unique title, description, canonical, Open Graph/Twitter, and relevant structured-data metadata; keep `robots.txt` and the sitemap aligned.
- Use CSR for interactive or personalized state such as carts, authentication context, filters, and infinite scrolling, while keeping core content crawlable without JavaScript.
- Keep server/client boundaries intentional: fetch public data on the server where practical, pass minimal props, never expose secrets, and avoid hydration mismatches.
- Preserve semantic HTML, stable URLs, accessible links/headings, optimized images, and fast loading as part of SEO quality.

## Verification for frontend changes

- Check the affected routes and interactions at narrow, intermediate, and wide layouts; dashboards require light and dark checks, while Customer screens remain light-only.
- Verify keyboard access, visible focus, readable status/error text, and the relevant loading/empty/failure states.
- Run the affected package's configured type, lint, and build checks as appropriate. Report browser checks separately from static/build checks and identify checks that could not run.
- Keep verification scoped to changed screens and shared-component consumers. Updating these rules does not mark existing feature acceptance criteria complete.
