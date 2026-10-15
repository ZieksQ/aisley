# AISLEY Design System

## Scope and authority

This is the single visual design contract for `src/webapp` (Customer), `src/admin`, `src/seller`, `src/logistics`, and the shared web UI they consume from `packages/ui`.

Revised on 2026-10-14 using the [gpt-taste skill](../.agents/skills/gpt-taste/SKILL.md). Retain compatible spacing, radii, shadows, components, responsive behavior, themes, accessibility, and interaction rules from the previous guide. Replace its pink-primary palette and Inter typography with the role palettes and typography below.

- Read this guide before changing web UI, layout, styling, accessibility, or client-side behavior. It replaces the previous visual prescriptions and styling exceptions for messaging, Finance, Sort plan, Settings, Shops, and vouchers.
- Feature specifications own workflows, required content, permissions, navigation destinations, security, and API behavior. They do not establish separate visual systems or aesthetic exceptions. Preserve their required interactions when applying this guide.
- The installed `design-taste-frontend`, `gpt-taste`, and `redesign-existing-projects` skills remain design aids. This guide takes priority over conflicting skill palettes, typography, layout rules, visual bans, and inspector preferences. Apply only compatible guidance; skill checks do not override this contract.
- Apply gpt-taste's varied composition, wide headings, complete bento layouts, intentional assets, legible buttons, and reduced-motion behavior. Scope its AIDA structure, cinematic spacing, randomized hero/component selection, and advanced scroll effects to promotional experiences. The role requirements below take priority on commerce and portal task screens.
- Installing or invoking a design skill does not authorize adding GSAP, another framework, an icon library, or other application dependencies. GSAP adoption requires explicit dependency approval; preserve the declared stack and use existing CSS interaction feedback until then.
- Preserve the declared stack, folder structure, role boundaries, and responsibility-based modularity rules. This documentation update defines the target design; it does not automatically restyle or certify existing screens.
- `src/couriermockup`, the external Buyer/Courier Flutter designs, copied mobile documentation, and historical progress/verification records retain their separate scope.

## Brand identity

**Brand name:** AISLEY
**Industry:** Multi-tenant e-commerce and delivery operations

Use AISLEY's existing name, logo, and approved product language. The storefront is a recognizable general e-commerce marketplace. Admin, Seller, and Logistics are dashboard portals, with visual craft serving shopping or operational tasks.

## Role design rules

| App | Experience | Brand palette | Theme |
| --- | --- | --- | --- |
| Customer `src/webapp` | General e-commerce storefront | Purple | Light only |
| Admin `src/admin` | Administration dashboard portal | Same purple as Customer | Light and dark |
| Seller `src/seller` | Store management dashboard portal | Same purple as Customer | Light and dark |
| Logistics `src/logistics` | Delivery operations dashboard portal | Blue with slate neutrals | System / Light / Dark |

### Customer storefront

- Start with familiar marketplace navigation: AISLEY identity, prominent search, category access, account, and cart. Preserve feature-defined destinations and responsive behavior. Use a full-width commerce header rather than a floating navigation pill that competes with search.
- Home and campaign pages may include a wide promotional banner followed by categories, product collections, and relevant shopping actions. Apply AIDA within these promotional compositions while keeping products easy to reach.
- Search and category pages prioritize filters, sorting, results, and product grids. Product detail pages prioritize accurate imagery, price, variations, availability, Shop information, and purchase actions. Cart, checkout, authentication, account, and messaging use direct task layouts.
- Product cards use consistent image ratios, clear titles and prices, and compact spacing. Their quantity follows the catalogue and viewport; the promotional bento limit of 3–5 cards does not limit product results.
- Purple marks primary shopping actions and selection. Use neutral light surfaces around product images so merchandise remains the visual focus.
- Keep shopping controls and essential product information immediately readable. Reserve cinematic headings, rich backgrounds, and scroll storytelling for campaign content; ordinary browsing and checkout use practical spacing and restrained motion.

### Admin and Seller portals

- Use a stable application shell with role-specific sidebar navigation, a top utility bar, a clear page title, and a main workspace. Collapse navigation to an accessible drawer on phones.
- Use the same purple action, focus, link, and selection tokens as the storefront. Establish portal character through navigation, information density, tables, forms, charts, and task hierarchy.
- Put the current task, primary action, filters, and essential information near the top. Use compact, aligned table rows, readable forms, and intentional summary panels. Preserve feature-required metrics and status information.
- Apply visual variety to meaningful workspace composition, such as a summary strip above a table or a detail panel beside a list. Keep navigation, control positions, typography, and interaction patterns consistent between routes.
- Use 16–32px workspace gaps. AIDA heroes, cinematic section padding, scroll pinning, and stacked storytelling belong to promotional pages, not portal task flows.

### Logistics portal

- Follow the same dashboard shell, density, responsive behavior, and task hierarchy as Admin/Seller, with Logistics-owned navigation and workflows.
- Use blue for primary actions, selected navigation, links, focus, and chart emphasis. Retain the previous guide's cool slate dark surfaces and neutral text treatment; the blue accent tokens below define the revised Logistics brand.
- Prioritize operational lists, filters, delivery details, approvals, and feature-required maps or planning views. Keep labels and status meanings consistent; blue is a brand accent, while semantic colors communicate outcomes.
- Preserve System/Light/Dark controls and organization boundaries. Shared components resolve colors from the consuming role's palette instead of hard-coding purple.

### Applying gpt-taste before UI implementation

Before writing UI code, provide a `<design_plan>` with the role, page purpose, palette, theme, and layout. For promotional pages, include the skill's three-line deterministic Python selection report with the seed, one hero architecture, one allowed font, three distinct arsenal components, and two advanced motion paradigms. Record actual execution or clearly label a simulation; do not claim simulated choices were executed. Fit selections to the campaign content and record any role, accessibility, or dependency constraints before implementation.

- Check Navigation → Attention → Interest → Desire → Action on promotional pages. On task screens, check navigation → task context → working content → primary action; record hero and AIDA checks as inapplicable.
- For heroes, state the heading width and responsive type size, target 2–3 lines, and verify actual wrapping in the browser. A width class alone cannot guarantee line count. Confirm no decorative stamp icons, spam tags, or raw statistics clutter the hero.
- For bento sections, show the occupied grid cells at each breakpoint and confirm `grid-flow-dense`; for ordinary product grids or tables, check logical reading order and usable density instead.
- Check meaningful labels, visible button text, contrast, focus, reduced motion, and horizontal overflow. Keep commerce and portal functions intact.

---

## Color Palette

### Role brand colors

| Token | Hex | Usage |
| --- | --- | --- |
| Purple primary | `#4C1268` | Customer/Admin/Seller primary actions and brand anchors; white foreground |
| Purple hover | `#3D0E54` | Purple action hover |
| Purple active | `#300B42` | Purple action pressed state |
| Purple accent | `#6D28D9` | Supporting links, selection indicators, campaign emphasis |
| Purple tint | `#F1EAF4` | Purple selected backgrounds; `#4C1268` foreground |
| Purple dark accent | `#C4B5FD` | Links, focus, and selected text on dark portal surfaces |
| Blue primary | `#2563EB` | Logistics primary actions and brand anchors; white foreground |
| Blue hover | `#1D4ED8` | Blue action hover |
| Blue active | `#1E40AF` | Blue action pressed state and light-theme emphasis |
| Blue tint | `#EFF6FF` | Logistics selected backgrounds; `#1E40AF` foreground |
| Blue dark accent | `#93C5FD` | Logistics links, focus, and selected text on dark surfaces |
| Purple light page | `#F7F5F7` | Customer/Admin/Seller light canvas |
| Blue light page | `#F8FAFC` | Logistics light canvas |
| Light foreground | `#231429` | Primary light-theme text |

Customer, Admin, and Seller share one purple brand family. Logistics uses its blue family over cool neutral surfaces. Resolve semantic presentation tokens such as `brand-primary`, `brand-hover`, `brand-active`, `brand-tint`, and `brand-focus` at the app/theme boundary; shared components consume these tokens. Pink is no longer the default action, focus, or selection color.

### Dashboard graph colors

Graph series and categories may use different colors. Role primary colors govern actions and selection; they do not limit all chart data to one color. Use the shared violet, blue, teal, amber, rose and slate graph tokens, with lighter dark-theme equivalents. Keep category labels/counts available so color is supplementary. Use semantic colors consistently when a series represents an outcome, and do not invent trends or targets to decorate a card.

### Dashboard KPI cards

- Keep KPI cards independent in the responsive grid. Do not place decorative icons in them. Use a bold metric title and bold primary value, with the value as the strongest visual element and a short description explaining what it measures.
- Place a tiny line, bar, or area chart on the right when the owning feature has enough truthful data to visualize. Use the same metric and cohort as the title/value, keep category/period context accessible, and do not imply unsupported growth, targets, or history. If a useful chart cannot be derived from available data, retain the text summary without fabricating series.
- Put a concise text link to the owning workspace on the right below or beside the chart. The card itself is informational: it has no hover movement and no focus ring, border, or outline. The semantic link remains keyboard operable with a visible `:focus-visible` indicator; suppress pointer-only focus decoration without removing keyboard focus.
- Chart drawing or value transitions may animate briefly using transform, opacity, or SVG path drawing. Render the complete readable value and chart without animation first; disable animation under `prefers-reduced-motion`. Motion never delays actions or communicates a value that is absent from the source.
- Preserve role authorization, tenant scope, null/unavailable versus zero semantics, theme tokens, accessible chart summaries, and skeleton geometry. A link may appear only when its destination belongs to the metric's owning feature.

### Semantic colors

| Token | Hex | Usage |
| --- | --- | --- |
| Error | `#FF3B30` | Errors, destructive actions, validation |
| Warning | `#FF8800` | Warnings and decisions needing attention |
| Success | `#22C55E` | Success indicators and confirmations |

Retain existing error, warning, and success meanings. Existing contextual status colors may remain where their meaning is consistent. Communicate status with text or icons as well as color, and use contrast-safe foregrounds or darker variants for semantic text and buttons.

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
| Dark page | `#0F172A` | Dashboard dark canvas; raised surfaces use `#1E293B` |

Blend the role's brand accents into neutral surfaces through clear hierarchy: the primary color marks the main action or selection, accent variants support links and emphasis, and semantic colors communicate outcomes. Use readable tints and contrast-safe foregrounds. Strengthen control boundaries when needed; decorative border tokens are not sufficient for every control's contrast.

---

## Typography

### Font Families

- **Headings:** `Geist` (Bold 700, Semibold 600)
- **Body:** `Geist` (Regular 400, Medium 500)
- **Code/Mono:** `JetBrains Mono` for actual code and technical identifiers.
- Keep system fallbacks and use available font assets during adoption; font delivery or new dependencies follow the existing stack and approval rules. Ordinary labels and body copy use the body font.
- Geist is the shared application baseline and is already configured in the storefront. Do not introduce Inter. For a distinct promotional composition, the skill may select Satoshi, Cabinet Grotesk, Outfit, or Geist using available, approved font assets; retain Geist for surrounding commerce controls and portal screens.

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

Scale large headings down at narrow widths while retaining semantic heading order, readable wrapping, and browser text zoom. Product information, prices, forms, and operational data determine hierarchy; display typography is optional on task screens. Give promotional H1s a wide container (`max-w-5xl`, `max-w-6xl`, or available width) and fluid sizing, such as `clamp(2rem, 5vw, 5.5rem)`, targeting 2–3 lines at supported widths. Shorten copy or adjust size and width before accepting a narrow text wall; never clip headings to enforce the target.

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
| `space-32` | 128px | Wide-screen promotional chapter padding |
| `space-48` | 192px | Large cinematic campaign sections |

---

Use smaller spacing tokens on phones and for dense operational content; increase spacing when the viewport and content allow it. Promotional chapters may use `py-32 md:py-48` where appropriate, reduced to 48–64px on narrow screens. Catalogue sections use 24–48px gaps; portal workspaces use 16–32px gaps. Match spacing to the role and task rather than applying cinematic padding to every page.

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

- **Primary** — Filled, role primary background with white text
- **Secondary** — Outlined, role brand border and text; use readable theme equivalents
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

- Default → role hover token → role active token → clearly disabled treatment with readable text
- Keyboard focus (`:focus-visible`): visible 2px ring with 2px offset in the role's brand color or a contrast-safe theme variant

---

Use theme-appropriate hover/active variants and verify contrast in every state. Disabled opacity must preserve readable labels and clear disabled semantics; use the actual disabled attribute where appropriate. Error red with white small text misses the body-text contrast target, so retain the semantic color with a contrasting foreground or darker interaction variant.

SM/MD sizes describe visual heights; expand their hit areas to at least 44×44px without overlapping adjacent controls. Padding must fit the specified height and text line height.

### Inputs

- Height: **40px** (MD), **48px** (LG)
- Border: `1px solid #D1D5DB`
- Focus border: 2px in the role's brand color or an equivalent contrast-safe ring without layout shift
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
- Product and campaign images within clickable cards respond to hover with a contained scale up to `1.05`, using `overflow-hidden` and a 700ms ease-out transition. Keep titles, prices, controls, and surrounding layout stable; provide equivalent focus feedback and remove scaling for reduced motion. Portal rows and controls use restrained color/border feedback rather than image-style zoom.

---

### Badges / Tags

| Variant | Background | Text |
|---------|------------|------|
| Default | `#E5E7EB` | `#374151` |
| Purple brand (Customer/Admin/Seller) | `#F1EAF4` | `#4C1268` |
| Blue brand (Logistics) | `#EFF6FF` | `#1E40AF` |
| Success | `#DCFCE7` | `#15803D` |
| Warning | `#FEF3C7` | `#B45309` |
| Danger | `#FEE2E2` | `#B91C1C` |

---

Badge tints follow the consuming role's palette. Use readable dark-theme equivalents and meaningful text or accessible names; variant colors must not invent new status meanings. Keep functional status, stock, category, and filter labels; omit arbitrary promotional pill-tags and stamp badges around hero text.

### Navigation

- Sidebar width: **240px** (expanded), **64px** (collapsed)
- Top navbar target height: **64px** per toolbar row; storefront search/category content may use additional responsive rows
- Active item: role brand indicator (3px) + role tint background, with a dark-theme tint and accessible current state
- Item padding: `12px 16px`
- Icon size: `20px`

---

Keep role navigation groups, destinations, permissions, Settings routes, and active-route behavior from the feature specifications. Responsive drawers must remain usable on phones and restore focus when closed.

## Iconography

- **Library:** existing `react-icons`; use `react-icons/lu` for a consistent outline treatment, without introducing a separate Lucide or Phosphor dependency
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
| `anim-image` | 700ms | ease-out | Contained product/campaign image hover |

---

Commerce and portal screens use responsive hover, focus, selection, drawer, and dialog feedback. Keep task content readable at rest and during transitions. Motion must not delay actions, steal focus, or obscure content.

### Advanced promotional motion

When GSAP and `@gsap/react` are explicitly approved and available, use real `ScrollTrigger` implementations for the promotional paradigms selected in the design plan:

- **Pinned split:** Keep a campaign title on the left while imagery scrolls on the right; return to normal document flow on narrow or short viewports.
- **Image scale/fade:** Move decorative campaign media from `scale: 0.8` to `1`, then fade toward `opacity: 0.2` on exit. Keep product evidence, prices, purchase controls, and essential content at full opacity.
- **Scrubbing text:** Reveal nonessential campaign copy progressively from `opacity: 0.1` to `1`. Keep essential copy visible without animation or JavaScript.
- **Card stacking:** Stack campaign panels through scroll progress while preserving accessible reading order and reachable links.

Use `useGSAP` or the project's approved equivalent with scoped refs and cleanup on unmount/navigation. Gate setup through a reduced-motion media query, account for image loading and viewport changes, and keep animation code within the appropriate client boundary. Native scrolling and purchase flows must remain usable.

Respect `prefers-reduced-motion`: remove movement and spring effects when requested and keep essential feedback immediate. Under reduced motion, pinning, scrubbing, scale/fade, stacking, and marquees resolve to static, full-opacity content at `scale: 1`, in normal document flow, with no auto-scroll. Render that readable state before animation setup and preserve it if scripts fail.

## Promotional components, content, and assets

- Choose meaningful components from the skill's arsenal: inline heading images, horizontal accordions, partner marquees, and testimonial carousels. A selected component needs suitable content; record omissions in the design plan rather than fabricating reviews, partners, or endorsements.
- Inline typography images are decorative campaign accents with reserved dimensions and sensible mobile sizing. They must not replace words needed to understand the heading.
- Horizontal accordions also expand through keyboard and touch controls, with visible labels and expanded-state semantics. Carousels expose Previous/Next controls; automatically moving content has a pause control.
- Use actual approved product and Shop media for commerce. Promotional media must match its subject and preserve image fidelity where shoppers evaluate merchandise. The skill's seeded Picsum URLs are permitted only for clearly marked prototypes; a seed does not guarantee a relevant image. Production requires approved, relevant assets.
- Filters, luminosity blending, radial overlays, grain, or subtle mesh gradients may enrich campaign imagery and backgrounds where text contrast remains strong. Product photos retain accurate colors; tables, forms, checkout, and portal workspaces use calm neutral surfaces.
- Use meaningful headings instead of decorative meta-labels such as “SECTION 01” or “QUESTION 05.” “About us” may identify a real destination, but must not be an ornamental hero eyebrow. Keep required order numbers, statuses, steps, and field labels.
- Use professional language and existing icons; do not add decorative emoji to UI, comments, or design output.

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

### Bento density and overflow

- Promotional bento sections use 3–5 intentional panels and `grid-flow-dense` (`grid-auto-flow: dense`). Verify the spans tile the declared rows and columns without missing corners at every breakpoint; equal area alone does not prove correct placement.
- For example, a 4-column, 2-row grid can contain one 2×2 panel on the left and four 1×1 panels on the right: `4 + 1 + 1 + 1 + 1 = 8` occupied cells. At narrow widths, reset spans and stack the five panels without holes.
- Keep DOM and visual reading order aligned for keyboard and assistive technology. If dense packing reorders interactive content, revise the spans or simplify the layout. Ordinary product grids and operational tables preserve source order and do not require dense packing or equal promotional spans.
- Bound animated promotional wrappers with `w-full max-w-full overflow-x-hidden` where appropriate. Fix oversized children rather than masking broken layouts; do not clip focus rings, dropdowns, sticky content, or legitimate table overflow. Wide operational content scrolls inside its own labeled region.

## Dark Mode

The Customer storefront is **light-only**, including authentication, account, checkout, and shared screens. Admin, Seller, and Logistics support **light and dark** through their existing theme controls. Retain Logistics System/Light/Dark preference behavior.

| Light Token | Dark Equivalent |
|-------------|-----------------|
| `#F7F5F7` / `#F8FAFC` portal page | `#0F172A` |
| `#FFFFFF` surface / `#F3F4F6` subtle bg | `#1E293B` |
| `#111827` / `#231429` text | `#F1F5F9` |
| `#4B5563` muted text | `#94A3B8` |
| `#E5E7EB` / `#D1D5DB` border | `#334155` |

---

Admin/Seller retain purple and Logistics retains blue in both themes. Filled brand buttons keep white text; links, focus, and selected text use Purple dark accent or Blue dark accent on dark surfaces. Use darker tinted selected backgrounds such as `#2E1B3B` with `#C4B5FD` text for purple and `#172D4A` with `#93C5FD` text for blue. Check selected states, semantic badges, fields, overlays, and disabled controls in both dashboard themes. Shared UI follows its consumer's theme; browser dark preference must not activate dark styling in the storefront.

## Accessibility

- Minimum contrast ratio: **4.5:1** for body text, **3:1** for large text
- Keyboard navigation has visible focus indicators. Pointer clicks on buttons, links and informational charts should not retain an unnecessary outline or ring; use `:focus-visible` for keyboard treatments. Inputs retain clear editing focus.
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
- Promotional verification also checks actual hero line counts, bento cell coverage and reading order at each breakpoint, image fidelity, contained hover transforms, scroll-effect cleanup, reduced-motion/static fallback, and overflow. Portal verification checks information density, table scrolling, stable navigation, and accessible actions in each supported theme.
- Run the relevant package's configured type, lint, and build checks. Record actual browser and static checks separately, along with limitations.
- Documentation changes alone do not establish browser, application, or Flutter acceptance. Preserve historical evidence and feature completion status.
