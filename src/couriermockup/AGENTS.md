# Courier mockup rules

This project is a development-only React harness for checking the Courier API contract. It is not the production Courier client; production Courier screens belong to the external Flutter application.

## Working rules

- Prioritize endpoint behavior, loading states, error states, and truthful API responses over visual polish. Keep the UI plain and easy to replace with Flutter screens.
- Every API request must use the documented `/api/v1/courier/...` route and `Authorization: Bearer <token>` when protected. Never use Sanctum cookies, CSRF setup, `credentials: include`, or browser-cookie auth.
- The browser mockup may keep the bearer token in `sessionStorage` only to make local endpoint testing possible. Flutter must store tokens in OS secure storage and must never copy this storage choice into production.
- Never display, log, or put a bearer token in request history, query parameters, URLs, or API error messages.
- Resolve the Courier from the token. Do not add client-selected courier IDs, roles, statuses, Logistics organizations, hubs, or ownership fields.
- Use only routes documented as implemented. Do not invent shipment, assignment, scanning, delivery, proof, earnings, or offline behavior while the operational schema is deferred.
- If a new API-backed screen is added, update the matching Courier specification first and keep its states faithful to the Laravel response.
