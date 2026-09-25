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
- A desktop layout alone is not completion. Check narrow, intermediate, and wide layouts, including the affected light/dark states for dashboards.

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

## General Rules

- Maintain consistent spacing, typography, radius, and component behavior.
- Apply the mobile-first responsive behavior above to every new or changed web feature.
- Use color for hierarchy and meaning, not decoration alone.
- Maintain sufficient contrast and accessible focus/hover states.
- Keep customer UI and professional dashboards visually distinct while sharing the same design system.
- Favor simple, polished interfaces over unnecessary visual complexity.
- Give icon-only actions accessible names, keep forms visibly labeled, and make navigation/dialog controls keyboard-operable with visible focus and appropriate expanded states.
- Provide loading, empty, validation, error, disabled, and success states where the workflow needs them. Do not present failed requests as successful empty results or use color as the only status cue.

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
