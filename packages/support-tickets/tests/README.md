# Support ticket presentation checks

Run from the repository root using installed dependencies:

```sh
node packages/support-tickets/tests/serve.mjs
```

In separate terminals, start an isolated Chromium and run the checks:

```sh
chromium --headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu --user-data-dir="$PWD/node_modules/.cache/support-browser" --remote-debugging-port=19348 about:blank
node packages/support-tickets/tests/browser.mjs
```

The fixture renders the actual shared Customer/Seller workspace, Logistics workspace, and Admin detail with controlled ticket data. It checks 320/390/768/1440/1800px, supported light/dark variants, overflow, scrollable history, visible reply composers, safe plain text, cancelled draft switching, exact uncertain retries, older-history anchoring, new-activity behavior, Admin view-only presentation, role/theme accent inheritance, management disclosure and Send-button visibility, form focus/cancel, mobile Back, empty/error states and resolved-ticket guidance. Screenshots are saved under ignored `node_modules/.cache/support-tickets`.

These checks do not certify role shells, real authentication, Admin mutations, router-specific Back protection, live API integration, or external Flutter clients. The existing Logistics settings/support suite additionally covers its router guard and API-fixture interactions; its current Settings fixture fails before reaching support because the shell expects notification summary data that the fixture does not provide.
