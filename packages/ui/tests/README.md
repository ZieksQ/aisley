# Chat UI browser fixtures

Run these scripts from the repository root after workspace dependencies and the relevant production builds are available. They install no dependencies or browsers. The browser driver uses an installed Brave/Chromium CDP pipe; set `CHROMIUM_BINARY` if it is not at the default location.

## Shared component fixture

Generate the fixture, then run its browser checks:

```sh
node packages/ui/tests/chat-fixture.mjs
node packages/ui/tests/chat-browser.mjs
```

`chat-fixture.mjs` transpiles the actual `packages/ui/src/chat` modules, compatibility facade, and Customer `MessagePageShell`. It builds CSS from the real storefront `globals.css` using the installed Tailwind PostCSS plugin. The chat transport and outer brand bar are synthetic. `chat-browser.mjs` exercises responsive inbox/thread layouts, themes, keyboard and IME behavior, message states, viewer Retry rendering and image decoding, media upload failure/retry/remove, attachment-only empty-caption send and locked retry preserving ready attachment IDs, and private-state cleanup.

## Built application routes

Build the Customer, Seller, and Logistics apps first:

```sh
pnpm --dir src/webapp exec next build --webpack
pnpm --dir src/seller build
pnpm --dir src/logistics build
```

Then keep all three production servers running in separate terminals:

```sh
PORT=15300 pnpm --dir src/webapp start
```

```sh
pnpm --dir src/seller exec vite preview --host 127.0.0.1 --port 15174
```

```sh
pnpm --dir src/logistics exec vite preview --host 127.0.0.1 --port 15176
```

Run the app-route fixture from the repository root:

```sh
node packages/ui/tests/chat-app-browser.mjs
```

The script visits actual production-built role routes and installs synthetic auth/chat HTTP responses before app scripts run. Its Customer new-conversation journey uses the real role client to retry an uncertain first send with the same body and key, then checks committed-thread navigation and Back to inbox channel restoration alongside responsive/light-only layout. It does not use real accounts or send chat writes to a live API.

With all three production preview servers still running, run the short-viewport media fixture:

```sh
node packages/ui/tests/chat-app-media.mjs
```

This fixture selects seven existing role/channel routes: Customer Shop, delivery, and Courier; Seller Shop, Logistics, and Courier; and Logistics operational chat. It checks the collapsed limits disclosure, upload failure/retry/remove, attachment-only exact retry, and private-state cleanup. In the 320×500 and 390×500 selected-media states, it checks the actual center-point hit target with `document.elementFromPoint` for Remove, Retry, and Send controls, so clipped or covered pointer targets fail the fixture. Synthetic media/auth/transport do not exercise a live API.

For the Customer Shop profile card and prospective Product entry, run:

```sh
node packages/ui/tests/chat-app-profile.mjs
```

This fixture uses the Customer preview server at port 15300. It covers pointer and keyboard open/close, Escape and focus restoration, safe **View shop** navigation, the three Shop availability labels, and the legacy `/messages/new` Product redirect through a first send. It also removes the prospective Product context, loses the first-send response, navigates to the inbox while a matching thread appears, and returns through browser history. The journey checks that the unresolved send is not redirected prematurely, the intentional context removal stays removed, and the original body/key are restored for an exact retry. Its responses are synthetic; it does not verify live API access or external Buyer app behavior.

## Artifacts, profile, and limits

Component and app-route screenshots/results default to the ignored `node_modules/.cache/messages-ui/` directory; those scripts accept `CHAT_SCREENSHOTS` where documented. The media fixture writes screenshots and its result record under `docs/loop/messages-ui-ux-20261011/`; the profile fixture writes screenshots there. All browser scripts use one profile at `node_modules/.cache/messages-ui/test-profile`; run the component, app-route, media, and profile scripts sequentially, never concurrently, and do not share that profile with another verifier.

These fixtures do not verify live API authorization, tenant isolation, database concurrency, private storage/scanning, or deployment behavior. CDP keyboard, touch, and viewport emulation is not physical-device, screen-reader, or installed-app testing. The component fixture transpiles sources for rendering; it does not replace type, lint, or production build checks.
