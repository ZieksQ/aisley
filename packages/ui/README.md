# Shared web UI

Dashboard consumers import `@aisley/ui/portal` and load `@aisley/ui/portal.css` once in their Tailwind entry stylesheet. Keep the existing `@source` directive for `packages/ui/src`.

`PortalShell` owns the 240px sidebar, optional 64px rail, mobile drawer, utility bar, account footer, and skip link. Each role still owns its routes, authorization, API clients, notifications and theme preferences. `PortalNavigation` accepts role-defined groups and a `renderLink` callback, so the UI package does not depend on React Router. Groups are always visible. Desktop collapse preferences are saved per role; phone drawers contain focus, make the workspace inert, close on Escape/navigation and restore focus.

`@aisley/ui/charts` exports `DataChart` and its typed data/series props. Recharts is declared in this package. Use only authoritative, permitted counts or time series from the consuming feature; a missing value is `null`, never an invented zero.

```tsx
import { DataChart } from '@aisley/ui/charts'

<DataChart
  title="Product status"
  layout="vertical"
  data={catalogRows}
  series={[{ key: 'count', label: 'Products', color: 'var(--portal-accent)' }]}
  height={240}
  barRadius={4}
  variant="panel"
/>
```

Series support `bar`, `line`, and `area` with individual colors, labels and line dashes. Configure grid/legend visibility, curve, fill opacity, stroke width, bar radius, label width, height, number formatting, `className` and `style`. Portal tokens supply role-aware light/dark defaults; custom consumers can set the same variables or pass series colors. A screen-reader table accompanies every successful Cartesian chart, including all-zero data; unavailable, loading, error and retained stale states remain distinct. Chart values render immediately without motion.

Brand assets live in `public/aisley-logo.svg` and `public/aisley-logo-with-title.svg`, copied unchanged from the storefront. Import `aisleyLogo` or `aisleyLogoWithTitle` from `@aisley/ui/brand`; Vite bundles their URLs, so consumers do not need duplicate public folders. `public/fonts` contains the existing Geist Latin font and its SIL Open Font License. The wordmark uses a monochrome light/dark CSS treatment for contrast; original SVGs remain intact.

Run `node packages/ui/tests/portal-browser.mjs` from the repository root with the three Vite apps at ports 15175 (Admin), 15174 (Seller), and 15176 (Logistics). The browser checks load actual app routes with synthetic HTTP contracts. They cover desktop/rail/drawer layouts, responsive themes, focus, reduced motion, zero/error states, permissions, chart data, and read-only behavior. Screenshots are written to `node_modules/.cache/portal-browser`; these checks do not establish live API acceptance.

Alternatively, `node packages/ui/tests/portal-browser.mjs --serve` starts isolated Vite servers on 16175/16174/16176 and stops those child processes after verification.

`DashboardSkeleton` is exported from `@aisley/ui/portal` and mirrors the separate metric cards and chart/work panels. Render it inside the workspace rather than replacing `PortalShell`; the pulse respects reduced motion. Informational chart pointer focus is suppressed while keyboard focus and the chart data table remain accessible. Portal guards resolve identity before mounting the shell and gate role screens inside it.

Use `--final-checks` alongside `--serve` to run only the final permission, required-consent and Logistics System-theme assertions when splitting a long browser run. Fixture flags reset at startup so interrupted runs cannot leave simulated denials behind.

`DashboardMetricCard` presents a role-supplied bold title and primary value, a short explanatory description, a tiny role-owned chart when its source supports one, and a text link to the owning workspace. KPI cards are independent; they do not use icons or card-level hover/focus/border/outline treatments. The link keeps a visible keyboard `:focus-visible` indicator while pointer-only decoration is suppressed. Tiny charts may animate in, but must start from a fully readable static state and honor `prefers-reduced-motion`. Keep KPI meaning, cohort, permissions, and unavailable/zero handling in the consuming role app; the shared UI does not invent data. Use `dashboard-metric-grid` for the separate cards. `DistributionChart` from `@aisley/ui/charts` renders an authoritative category breakdown with a numerical legend and a zero state. Chart category colors come from the six shared `--chart-*` tokens; Cartesian rows can supply `color` and series can supply their own colors. Visible chart-data disclosures have been removed. Pointer-click rings are suppressed on portal links/buttons/charts; keyboard indicators and editing focus remain.

For a bounded visual pass against production artifacts, add `--built --design-only --role=admin` (or `seller`/`logistics`) to `--serve`. This checks cards, multicolor graphs, click/keyboard focus, 320/390/768/1440px themes and empty/error states. The shared tooltip renders no inactive content to avoid hidden tooltip overflow on narrow pages.

`@aisley/ui/portal` also exports `PortalField`, `PortalSection`, `IconButton`, and `ConfirmationDialog`. These use the consuming portal's role/theme tokens. `PortalField` associates labels, hints and validation errors; `PortalSection` groups a task's working content; icon actions expose accessible names and keyboard/hover tooltips. The native confirmation dialog contains focus, cancels with Escape when idle and restores its trigger. Supply role-owned callbacks and content; API and lifecycle decisions stay in the app.

`@aisley/ui/portal` also exports `PortalModal`, `PortalPagination`, `PortalTable`, `PortalState`, and `PortalSkeleton` for role-owned workspaces. `PortalModal` uses a native dialog, labels its title/description, prevents Escape dismissal while busy, and restores focus on close. `PortalPagination` supplies labeled previous/next controls and an optional result count. `PortalTable` places a semantic table in a keyboard-focusable, labeled scrolling region. `PortalState` announces loading/empty/success content with a status role and failures with an alert role. `PortalSkeleton` provides static, accessible table-row placeholders. Keep query state and domain actions in the consuming app.
