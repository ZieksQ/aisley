# Storefront Auth-Aware Navigation and Route Access

## WHAT

- Make the customer storefront aware of a signed-in session on every page without preventing guests from browsing products, shops, search, or product-detail pages.
- Show guest navigation when no active Customer session exists; show the signed-in buyer’s profile information and account menu when it does.
- Add an account dropdown (not a modal) from the navbar profile control with links to Profile, Wishlist, Settings, and Logout.
- Redirect an already authenticated active Customer away from storefront sign-in and registration pages to the storefront home page (`/`).
- Scope: the Next.js customer storefront and its Laravel Sanctum session integration. Seller, Admin, Logistics, and Courier applications retain their separate role/domain routing.
- Non-goals: creating profile, wishlist, settings, registration, or role-switching functionality; this feature only exposes their existing/future destinations.

## MUST

- [ ] Treat Laravel’s server-validated session as the only authority for authentication. The presence of a browser cookie is only a routing hint; never expose user data or authorize an action from cookie presence alone.
- [ ] Keep the following storefront routes public to guests and authenticated customers: `/`, product listing/search, product detail, shop, and other browsing pages.
- [ ] Resolve the current user once per initial storefront render through an authenticated `GET /api/v1/auth/me` (exact endpoint is an implementation decision) and provide a normalized auth state to the shared navbar and client components.
  - Anonymous session / missing or invalid session: return an explicit `guest` state, not an error.
  - Active Customer session: return only data needed by navigation: `id`, display name, avatar URL or initials, `role`, and `status`.
  - A valid non-Customer role must not be treated as a customer storefront identity; follow the platform’s role/domain routing policy.
- [ ] Render a stable loading/skeleton state for the navbar until client-side auth resolution completes where server resolution is unavailable; do not briefly show a guest “Sign in” control to an authenticated user.
- [ ] Guest navbar must show the sign-in entry point and must not show personal data or the account dropdown.
- [ ] Authenticated Customer navbar must replace the guest sign-in control with an accessible profile trigger showing the buyer’s name or avatar/initials.
  - The dropdown opens by click, Enter, or Space; closes on Escape, outside click, and after selecting Logout; supports keyboard focus and ARIA menu/button semantics.
  - Items appear in this order: Profile, Wishlist, Settings, divider, Logout.
  - Each destination is a normal link, allowing future protected-route checks. Use the app’s final route conventions; proposed storefront paths are `/account/profile`, `/account/wishlist`, and `/account/settings`.
- [ ] Logout must call the Laravel logout endpoint with CSRF protection and cookie credentials, clear the shared auth state, close the menu, and redirect or refresh to `/` so guest navigation is shown.
  - If logout fails, keep the user state intact and display a recoverable error; do not merely delete client state.
- [ ] Protect buyer-only pages (including Profile, Wishlist, Settings, checkout/order/account pages) at both layers:
  - Next.js redirects unauthenticated requests to `/sign-in` and preserves a validated same-origin `next` path for return after login.
  - Laravel protects corresponding API operations with `auth:sanctum`, verifies `role=customer` and `status=active`, and enforces resource ownership. A frontend redirect is never the security boundary.
- [ ] For `/sign-in` and storefront registration routes, redirect an already authenticated active Customer to `/` before rendering the form. An unauthenticated, expired, inactive, or wrong-role session may view the applicable sign-in/error flow.
- [ ] After successful sign-in, refresh/revalidate the auth-aware layout and navigate to the validated `next` path, or `/` when none exists. Session expiry or a 401/419 response must clear client auth state and send protected-page requests to sign-in.
- [ ] Use the existing web-auth contract: request `/sanctum/csrf-cookie` before credential-changing requests; submit credentials/logout with credentials included and CSRF token support; keep session cookies `HttpOnly` and never store a session token in `localStorage`.
- [ ] Configure the production storefront and API as first-party subdomains of the same top-level domain. Sanctum stateful domains, credentialed CORS origins, and session-cookie domain must include the storefront; local development ports must also be configured.
- [ ] Do not rely on Next.js Proxy alone for definitive session validation. It may perform cheap redirects only when a trustworthy app-readable signal exists; the authenticated layout/server route must confirm the Laravel session through the API.

## HOW

- Frontend (`src/webapp`, Next.js App Router):
  - Add a shared `AuthProvider`/auth query and `useAuth()` contract with `loading | guest | authenticated` state plus `refresh()` and `logout()` actions.
  - In the root layout (or shared storefront layout), read incoming cookies on the server and forward the required cookie header to the backend’s current-user endpoint using a server-only API client. Mark this request dynamic/no-store so a user’s navbar is never served from another user’s cache.
  - Hydrate the provider with that server result. Use one deduplicated client query for navigation after login/logout, tab focus, and explicit refresh; do not call `/me` independently from every page/component.
  - Add `AccountMenu` to the existing navbar. Keep viewport-specific behavior aligned with the mobile navigation; the same destinations and logout behavior must remain available on mobile.
  - Add route groups/layouts for public, auth-only (`/sign-in`, registration), and buyer-protected pages. Use server-side guards in protected/auth-only layouts with `redirect()` after checking the normalized auth result.
  - Optionally add `proxy.ts` only for early pathname classification/redirects. Do not make it call the API on every request or trust cookie presence as authorization.
- Backend (`src/api`, Laravel):
  - Provide a versioned current-user endpoint such as `GET /api/v1/auth/me`, protected by `auth:sanctum`; return a minimal customer-navigation resource and a consistent unauthenticated response.
  - Keep login/logout on the session (`web`) guard and expose them through the agreed API/web routing boundary. Login must regenerate the session; logout must invalidate the session and regenerate the CSRF token.
  - Apply `auth:sanctum`, active-status, role, and ownership checks to all buyer-private APIs independently of Next.js.
  - Configure `statefulApi`, Sanctum stateful domains, CORS `supports_credentials`, exact allowed origins, and the session cookie domain for the storefront/API deployment topology.
- Data and interfaces:
  - No new database table is required; use the existing `users`, role profile, and `sessions` schema.
  - Keep the navbar DTO intentionally small. Fetch profile/settings details only on their dedicated pages.
  - Standardize client handling: `401` = no usable session; `403` = authenticated but not allowed; `419` = refresh CSRF/session flow then require sign-in if it cannot recover.
- Test and acceptance coverage:
  - Guest can browse public storefront pages and sees Sign in.
  - Active Customer reloads any public page and sees their profile trigger without a guest-nav flash.
  - Profile trigger/menu is keyboard accessible; all four actions navigate/operate correctly.
  - Guest access to every buyer-private route redirects to sign-in; direct API calls fail without a valid active Customer session.
  - Active Customer visiting sign-in or registration is redirected to `/`.
  - Login updates navbar immediately; logout invalidates the backend session, returns to guest navigation, and prevents access to buyer-private APIs/pages.
  - Expired/inactive/wrong-role sessions do not reveal customer data and receive the appropriate sign-in or forbidden result.
  - Automated tests cover API auth/role/status guards, auth-layout redirects, navbar states, menu accessibility, and logout failure handling.
- Sources and implementation guidance:
  - [Next.js Authentication guide](https://nextjs.org/docs/app/guides/authentication) recommends centralizing optimistic pre-filtering in Proxy but performing authorization checks close to the data source.
  - [Next.js redirect guidance](https://nextjs.org/docs/app/guides/redirecting) documents request-time redirects and `redirect()` for rendering flows.
  - [Laravel Sanctum SPA authentication](https://laravel.com/framework/docs/13.x/sanctum#spa-authentication) specifies first-party cookie sessions, shared top-level domains, CSRF initialization, credentialed CORS, and `auth:sanctum` protection.
- Open question:
  - Confirm final customer account URLs and whether the storefront will ever let a signed-in Seller/other role browse as a Customer. Until then, this spec treats only an active Customer as authenticated for customer-personalized UI.
