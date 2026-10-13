# AISLEY Design System

## Scope and authority

This is the single visual design contract for `src/webapp` (Customer), `src/admin`, `src/seller`, `src/logistics`, and the shared web UI they consume from `packages/ui`.

Adapted from the user-supplied `novaspark-design-system-DESIGN.md` on 2026-10-14. The typography, spacing, radii, shadows, components, motion, grid, dark-mode approach, and accessibility guidance below retain the source's structure, adapted to AISLEY's identity, colors, and declared stack.

- Read this guide before changing web UI, layout, styling, accessibility, or client-side behavior. It replaces the previous visual prescriptions and styling exceptions for messaging, Finance, Sort plan, Settings, Shops, and vouchers.
- Feature specifications own workflows, required content, permissions, navigation destinations, security, and API behavior. They do not establish separate visual systems or aesthetic exceptions. Preserve their required interactions when applying this guide.
- The installed `design-taste-frontend`, `gpt-taste`, and `redesign-existing-projects` skills remain design aids. This guide takes priority over conflicting skill palettes, typography, layout rules, visual bans, and inspector preferences. Apply only compatible guidance; skill checks do not override this contract.
- Retain the fonts and component tokens below when a skill proposes alternatives. Installing a design skill does not authorize adding GSAP, another framework, or other application dependencies; preserve the declared stack and approval rules.
- Preserve the declared stack, folder structure, role boundaries, and responsibility-based modularity rules. This documentation update defines the target design; it does not automatically restyle or certify existing screens.
- `src/couriermockup`, the external Buyer/Courier Flutter designs, copied mobile documentation, and historical progress/verification records retain their separate scope.

## Brand identity

**Brand name:** AISLEY
**Industry:** Multi-tenant e-commerce and delivery operations

Use AISLEY's existing name, logo, and approved product language. Adapt NovaSpark's design patterns to marketplace and operational workflows.

---

## Color Palette

### Brand and semantic colors

| Token | Hex | Usage |
| --- | --- | --- |
| Primary pink | `#E6007A` | Primary actions, selected states, brand accents |
| Secondary purple | `#4C1268` | Supporting actions, links, emphasis |
| Light page | `#F7F5F7` | Customer page background and branded light canvas |
| Light foreground | `#231429` | Primary light-theme text |
| Error | `#FF3B30` | Errors, destructive actions, validation |
| Warning | `#FF8800` | Warnings and decisions needing attention |
| Success | `#22C55E` | Success indicators and confirmations |

Retain AISLEY's existing primary, secondary, error, warning, Customer background, and foreground colors. Pink and purple replace Nova Blue in actions, focus, badges, and navigation. Existing contextual status colors may remain where their meaning is consistent. Communicate status with text or icons as well as color.

### Neutral colors

| Token | Hex | Usage |
| --- | --- | --- |
| White | `#FFFFFF` | Light cards, dialogs, inputs |
| Gray 900 | `#111827` | Neutral primary text where branded foreground is unnecessary |
| Gray 600 | `#4B5563` | Secondary text |
| Gray 400 | `#9CA3AF` | Nonessential placeholder hints; required instructions remain visible |
| Gray 300 | `#D1D5DB` | Decorative borders and dividers |
| Gray 200 | `#E5E7EB` | Quiet surface boundaries |
| Gray 100 | `#F3F4F6` | Subtle backgrounds |
| Dark page | `#0F172A` | Dashboard dark canvas and surfaces |

Blend brand accents into neutral surfaces through clear hierarchy: pink marks the main action or selection, purple supports links and secondary emphasis, and semantic colors communicate outcomes. Use readable tints and contrast-safe foregrounds. Strengthen control boundaries when needed; decorative border tokens are not sufficient for every control's contrast.

---

## Typography

### Font Families

- **Headings:** `Inter` (Bold 700, Semibold 600)
- **Body:** `Inter` (Regular 400, Medium 500)
- **Code/Mono:** `JetBrains Mono` for actual code and technical identifiers.
- Keep system fallbacks and use available font assets during adoption; font delivery or new dependencies follow the existing stack and approval rules. Ordinary labels and body copy use the body font.

### Type Scale

| Name | Size | Line Height | Weight | Usage |
|------|------|-------------|--------|-------|
| Display | 48px | 1.1 | 700 | Hero headings |
| H1 | 36px | 1.2 | 700 | Page titles |
| H2 | 28px | 1.3 | 600 | Section headings |
| H3 | 22px | 1.4 | 600 | Card headings |
| H4 | 18px | 1.4 | 600 | Sub-sections |
| Body LG | 18px | 1.6 | 400 | Lead text |
| Body | 16px | 1.6 | 400 | Default body |
| Body SM | 14px | 1.5 | 400 | Captions, labels |
| Caption | 12px | 1.4 | 500 | Metadata, tags |

---

Scale large headings down at narrow widths while retaining semantic heading order, readable wrapping, and browser text zoom. Product information, prices, forms, and operational data determine hierarchy; display typography is optional.

## Spacing System

Based on a **4px base unit**.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps |
| `space-2` | 8px | Icon padding |
| `space-3` | 12px | Small padding |
| `space-4` | 16px | Default padding |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Section gaps |
| `space-12` | 48px | Large sections |
| `space-16` | 64px | Page sections |
| `space-24` | 96px | Hero spacing |

---

Use smaller spacing tokens on phones and for dense operational content; increase spacing when the viewport and content allow it.

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Compact controls, small buttons |
| `radius-md` | 8px | Inputs, buttons, compact cards |
| `radius-lg` | 12px | Cards, modals, panels |
| `radius-xl` | 16px | Feature cards |
| `radius-full` | 9999px | Pills, avatars |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Dropdowns |
| `shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Modals |

---

## Components

### Reuse and ownership

- Inspect existing exports and reuse compatible components before adding another primitive.
- Put new or extracted reusable UI that multiple apps can use in **`packages/ui`**, exported through **`@aisley/ui`** or an appropriate subpath. Declare workspace dependencies explicitly. Avoid duplicate shared primitives and standalone presentation packages.
- Keep one-off screens, role navigation, authorization, API clients, and feature orchestration in their established owners under `src/`. Shared components accept safe presentation data and callbacks, without another role's private-data assumptions.
- Keep existing feature-specific packages in place; this guide does not require migrating them. Their shared presentation follows these tokens in each consumer's supported theme.
- Shared chat presentation and generic behavior stay in **`packages/ui/src/chat`**, exported through **`@aisley/ui/chat`**. **`@aisley/chat-ui`** remains a compatibility re-export facade.
- Preserve the repository's folder structure and responsibility-based modularity rules. Pages compose independent components; hooks/services manage state and clients parse API data.

### Buttons

#### Variants

- **Primary** — Filled, primary pink background with contrasting text
- **Secondary** — Outlined, secondary purple border and text; use readable theme equivalents
- **Ghost** — No border, transparent background
- **Destructive** — Semantic error fill or emphasis with a contrasting foreground and explicit consequence label
- **Link** — No background, underline on hover

#### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| SM | 32px | 8px 12px | 14px |
| MD | 40px | 10px 16px | 15px |
| LG | 48px | 12px 24px | 16px |

#### States

- Default → Hover (10% darker) → Active (20% darker) → Disabled (40% opacity)
- Focus: visible 2px ring with 2px offset in primary pink or a contrast-safe theme variant

---

Use theme-appropriate hover/active variants and verify contrast in every state. Disabled opacity must preserve readable labels and clear disabled semantics; use the actual disabled attribute where appropriate. Error red with white small text misses the body-text contrast target, so retain the semantic color with a contrasting foreground or darker interaction variant.

SM/MD sizes describe visual heights; expand their hit areas to at least 44×44px without overlapping adjacent controls. Padding must fit the specified height and text line height.

### Inputs

- Height: **40px** (MD), **48px** (LG)
- Border: `1px solid #D1D5DB`
- Focus border: `2px solid #E6007A` or equivalent ring without layout shift
- Border radius: `radius-md`
- Padding: 16px horizontally, with vertical padding fitted to the control height; multiline fields use `12px 16px`
- Placeholder color: `Gray 400`
- Error state: Red border + error message below

---

Use persistent visible labels, associated error messages, and at least 44px touch targets. Strengthen control borders when necessary for contrast. Required instructions must not depend on low-contrast placeholder text.

### Cards

- Background: `#FFFFFF`
- Border: `1px solid #E5E7EB`
- Border radius: `radius-lg`
- Padding: `space-6`
- Shadow: `shadow-md`
- Interactive-card hover: `shadow-lg` + slight translateY(-2px), with equivalent keyboard focus and reduced-motion support
- Static information cards do not imply clickability through hover movement. Use semantic links/buttons for actions and mapped surfaces/borders in dark mode.

---

### Badges / Tags

| Variant | Background | Text |
|---------|------------|------|
| Default | `#E5E7EB` | `#374151` |
| Primary | `#FFE4F1` | `#9E0054` |
| Secondary | `#F1EAF4` | `#4C1268` |
| Success | `#DCFCE7` | `#15803D` |
| Warning | `#FEF3C7` | `#B45309` |
| Danger | `#FEE2E2` | `#B91C1C` |

---

Badge tints blend AISLEY's palette into the source pattern. Use readable dark-theme equivalents and meaningful text or accessible names; variant colors must not invent new status meanings.

### Navigation

- Sidebar width: **240px** (expanded), **64px** (collapsed)
- Top navbar target height: **64px** per toolbar row; storefront search/category content may use additional responsive rows
- Active item: primary-pink indicator (3px) + light pink background, with a dark-theme tint and accessible current state
- Item padding: `12px 16px`
- Icon size: `20px`

---

Keep role navigation groups, destinations, permissions, Settings routes, and active-route behavior from the feature specifications. Responsive drawers must remain usable on phones and restore focus when closed.

## Iconography

- **Library:** existing `react-icons`; use `react-icons/lu` for the source's Lucide outline treatment, without introducing a separate icon dependency
- **Default size:** 20px (inline), 24px (standalone)
- **Stroke width:** 1.5px
- **Color:** Inherits from text color

---

## Motion & Animation

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `anim-fast` | 100ms | ease-out | Hover states |
| `anim-base` | 200ms | ease-in-out | Transitions |
| `anim-slow` | 350ms | ease-in-out | Modals, drawers |
| `anim-spring` | 400ms | cubic-bezier(0.34,1.56,0.64,1) | Scale-in effects |

---

Respect `prefers-reduced-motion`: remove movement and spring effects when requested and keep essential feedback immediate. Motion must not delay actions, steal focus, or obscure content.

## Grid & Layout

- **Max standard content width:** 1280px; messaging and operational workspaces may use available width when needed by the workflow
- **Gutter:** 24px, reduced to 16px at narrow widths
- **Columns:** 12
- **Breakpoints:**

| Name | Width |
|------|-------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

---

Build mobile-first from 320px. Collapse the grid according to content and viewport. Keep primary actions, forms, search, product information, and checkout usable before adding wider layouts. Contain wide tables in labeled scroll regions and keep essential actions reachable. Wrap or truncate long content accessibly. Bound dialogs/dropdowns to the viewport with internal scrolling; mobile keyboards must not hide chat composers or essential controls.

## Dark Mode

The Customer storefront is **light-only**, including authentication, account, checkout, and shared screens. Admin, Seller, and Logistics support **light and dark** through their existing theme controls. Retain Logistics System/Light/Dark preference behavior.

| Light Token | Dark Equivalent |
|-------------|-----------------|
| `#FFFFFF` surface / `#F7F5F7` branded page | `#0F172A` |
| `#F3F4F6` subtle bg | `#1E293B` |
| `#111827` / `#231429` text | `#F1F5F9` |
| `#4B5563` muted text | `#94A3B8` |
| `#E5E7EB` / `#D1D5DB` border | `#334155` |

---

Keep primary pink and secondary purple as brand anchors. Use lighter pink/purple text tints or contrasting fills where the anchors are too dark for a dark surface. Check selected states, semantic badges, fields, overlays, and disabled controls in both dashboard themes. Shared UI follows its consumer's theme; browser dark preference must not activate dark styling in the storefront.

## Accessibility

- Minimum contrast ratio: **4.5:1** for body text, **3:1** for large text
- All interactive elements have visible focus rings
- Touch targets minimum: **44x44px**
- Meaningful icons have visible labels or accessible names; hide decorative icons from assistive technology
- Keyboard navigable: Tab and Enter, plus Escape and Arrow keys where appropriate for the control
- Essential control boundaries, state indicators, and focus treatments have appropriate non-text contrast. Check actual foreground/background pairs in each state.
- Use semantic headings, lists, tables, links, buttons, and form labels; keep text usable under zoom. Dialogs contain focus, provide Close/Cancel, and restore focus to their trigger.

## Interaction and verification

- Prefer familiar e-commerce and dashboard interactions. Keep terminology, action labels, and status meanings consistent, with a clear primary action and predictable Back/Cancel behavior.
- Distinguish loading, empty, failed, successful, disabled, and read-only states. Give actionable validation and recovery feedback; failed reads must not appear as empty results.
- Confirm destructive actions and unsaved-input discard. Preserve safe input after recoverable failures and exact retry identity after uncertain mutations. Clear private state on logout or authorization loss.
- Preserve role authorization, store/organization isolation, approval gates, privacy, and required business rules in every visual treatment.
- Apply tokens through compatible shared primitives as changed screens adopt this design system. Keep role pages focused on composition and avoid competing app-local visual systems.
- For frontend implementation, verify narrow, intermediate, and wide layouts; keyboard/focus; loading/empty/error states; and each consumer's supported themes. Messaging also requires a short viewport and keyboard-open composer check.
- Run the relevant package's configured type, lint, and build checks. Record actual browser and static checks separately, along with limitations.
- Documentation changes alone do not establish browser, application, or Flutter acceptance. Preserve historical evidence and feature completion status.
