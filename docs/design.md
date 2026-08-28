# Design System

## Colors

- **Primary:** `#E6007A`
- **Secondary:** `#4C1268`
- **Error:** `#FF3B30`
- **Warning:** `#FF8800`
- Use additional contextual colors when they improve usability, accessibility, or meaning.

## Color Ratio

Follow the **60/30/10 rule**:

- **60%:** White / dark neutral backgrounds and surfaces
- **30%:** Secondary/supporting colors, borders, muted surfaces, typography
- **10%:** Primary and contextual accent colors

Avoid overusing the primary pink. It should guide attention rather than dominate the entire UI.

## Applications

### `webapp/`

Customer-facing e-commerce experience inspired by platforms such as Shopee, Amazon:

- light mode only
- Clean, modern, highly visual interface
- Product images and pricing are prominent
- Strong search, category, cart, and checkout UX
- Use cards, badges, filters, and clear calls-to-action
- Optimize for responsive/mobile layouts

### `admin/`, `seller/`, `logistics/`

Professional dashboard experience:

- with dark mode
- Clean and information-dense without feeling cluttered
- Sidebar navigation with clear active states
- Dashboard cards, tables, filters, forms, charts, and status badges
- Prioritize readability and efficient workflows
- Use contextual colors for statuses, warnings, and errors

## Components

Use `packages/*` for reusable UI components and design primitives.

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

## General Rules

- Maintain consistent spacing, typography, radius, and component behavior.
- Design responsive layouts by default.
- Use color for hierarchy and meaning, not decoration alone.
- Maintain sufficient contrast and accessible focus/hover states.
- Keep customer UI and professional dashboards visually distinct while sharing the same design system.
- Favor simple, polished interfaces over unnecessary visual complexity.

## Next.js SEO, SSR, and CSR

- Prefer SSR, SSG, or ISR for public, indexable content so meaningful page content and metadata are present in the initial HTML.
- Give each indexable route unique title, description, canonical, Open Graph/Twitter, and relevant structured-data metadata; keep `robots.txt` and the sitemap aligned.
- Use CSR for interactive or personalized state such as carts, authentication context, filters, and infinite scrolling, while keeping core content crawlable without JavaScript.
- Keep server/client boundaries intentional: fetch public data on the server where practical, pass minimal props, never expose secrets, and avoid hydration mismatches.
- Preserve semantic HTML, stable URLs, accessible links/headings, optimized images, and fast loading as part of SEO quality.
