# Production environment recovery and API keys

Run the commands below on the production VM from the repository root. The real
`docker/.env.production` stays private on that VM; Git tracks only the example.
The deployment workflow pulls code and rebuilds containers; it does not delete
the environment file. Its absence alone does not reveal how it was removed.

## 1. Preserve existing credentials before recreating containers

If the file disappeared, keep existing containers and volumes intact while
recovering credentials. Do not run `docker compose down`, remove containers,
prune Docker, or run `git clean -fdx` during recovery. Ignored files can be
deleted by `git clean -fdx`.

First check your password manager, secure backup or deployment administrator for
the original file. If containers still exist, their configured environment may
provide a recovery source, including stopped containers:

```sh
docker ps -a --filter label=com.docker.compose.project=aisley-production --format '{{.ID}} {{.Names}}'
```

Replace `API_CONTAINER_ID` below with the API container ID from that output.
Save its environment to a private, Git-ignored JSON file without printing secrets:

```sh
umask 077
docker inspect --format '{{json .Config.Env}}' API_CONTAINER_ID > docker/.env.production.recovery.json
chmod 600 docker/.env.production.recovery.json
```

Open that JSON locally on the VM with a trusted editor. It contains `NAME=value`
entries, not a dotenv file: copy required values into the restored environment
file and quote them appropriately. Do not paste the snapshot into logs, chat or
GitHub. The API environment should contain the original `APP_KEY`, database,
storage and mail settings. The Cloudflare container's environment contains its
`TUNNEL_TOKEN`, which maps to `CLOUDFLARE_TUNNEL_TOKEN` in the environment file.
Use the same private snapshot approach for that container if necessary.

Recover the **original `APP_KEY`** for an existing installation. Changing it
invalidates encrypted sessions and can make existing encrypted data unreadable.
Recover the **original database name, username and password** too. Changing
`DB_PASSWORD` in the file does not change the password stored in an existing
Postgres volume. If no copy survives, database password reset and application
key rotation require a deliberate recovery procedure; do not treat this as a
fresh installation or delete production volumes.

## 2. Recreate the private file only when it is missing

```sh
umask 077
if [ ! -e docker/.env.production ]; then
  cp docker/.env.production.example docker/.env.production
fi
chmod 600 docker/.env.production
```

Edit with `vim -n docker/.env.production` to avoid creating a swap file, or use
your usual editor. Restore recovered values and replace template placeholders.
For a completely new installation only, generate an `APP_KEY` with PHP:

```sh
php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

If PHP is unavailable on the VM, use a trusted PHP installation. Keep the key in
the private file and secure backup. Never regenerate it on every deployment.

## 3. Set domains, sessions and database configuration

| Setting | What to enter |
| --- | --- |
| `APP_URL` | Public HTTPS API origin, such as `https://api.example.com`. |
| `DB_HOST`, `DB_PORT` | `postgres`, `5432` for this Compose stack. |
| `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Original values for an existing database; unique credentials for a new installation. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact HTTPS storefront/dashboard origins, with protocols and no trailing slash. |
| `SANCTUM_STATEFUL_DOMAINS` | The same frontend hosts without protocols; include ports when applicable. |
| `SESSION_DOMAIN` | `.example.com` when API and apps share that parent domain. For unrelated frontend domains, leave blank for an API host cookie. |
| `SESSION_SAME_SITE` | `lax` for the same site; `none` for cross-site frontends such as unrelated Vercel domains. Browser third-party cookie restrictions can still affect cross-site sessions. |
| `SESSION_SECURE_COOKIE` | `true` with production HTTPS. |
| `CUSTOMER_STOREFRONT_URL`, reset URLs | Actual public frontend URLs matching the installed reset pages. |

Keep `APP_ENV=production` and `APP_DEBUG=false`. Quote dotenv values containing
spaces or `#`; single quotes also prevent Compose from expanding literal `$`
characters in passwords. Preserve intentional template interpolation such as
`MAIL_FROM_NAME="${APP_NAME}"`.

## 4. Obtain the Cloudflare Tunnel token

1. Sign in to the Cloudflare account that owns the existing API tunnel.
2. Open **Networking → Tunnels**, select the existing remotely managed tunnel,
   and use its connector installation instructions to retrieve the token.
3. Put only the token value in `CLOUDFLARE_TUNNEL_TOKEN`, not the installation
   command. A Cloudflare account API token is a different credential.
4. Confirm the published API hostname points to `http://nginx:8080`.

See [Cloudflare tunnel tokens](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/).

## 5. Obtain Geoapify keys and enable the Logistics map

1. Sign in at [Geoapify MyProjects](https://myprojects.geoapify.com/), create or
   select the Aisley project, then open **API keys**.
2. Create a browser key for Logistics. Restrict it to the exact deployed
   Logistics origin using the available browser origin/referrer restrictions.
   Add `http://localhost:5176` only if that key also supports local development.
3. In the hosting project that builds the Logistics frontend, set
   `GEOAPIFY_API_KEY` to that browser key for the Production build environment.
   If using Vercel, use the Logistics project's environment variable settings.
4. Rebuild and redeploy the Logistics frontend. Vite embeds the key at build
   time, so restarting the API will not update it. For a manual frontend build,
   the variable must be available to `pnpm --filter logistics build`.
5. Create a separate server key for Route Matrix, Routing and the Courier tile
   proxy. Put it in `GEOAPIFY_SERVER_API_KEY` in `docker/.env.production`.
   Restrict it to the VM's public outbound IP where practical, rather than
   browser origins. Never put this server key in frontend build variables.
6. Keep the template's timeout and daily credit limits unless intentionally
   adjusting the service budget. Reopen Fleet monitoring after frontend deploy.

This Docker Compose deployment builds the Laravel API and its Nginx server. It
does **not** build Logistics, Seller, Admin or Customer frontend bundles.
Consequently, adding `GEOAPIFY_API_KEY` only to `docker/.env.production` does not
enable the Logistics map. Customer uses `NEXT_PUBLIC_GEOAPIFY_API_KEY`; Seller
uses `GEOAPIFY_API_KEY` in its own frontend build environment.

The fleet map displays saved assignment stops, rather than live Courier GPS.
If configured but tiles fail, check provider restrictions/quota and browser
network responses; do not post requests containing keys in public logs.
See [Geoapify API key setup and restrictions](https://myprojects.geoapify.com/help/api-keys/)
and the canonical [map policy](../docs/maps-location-api.md).

## 6. Restore Azure Blob Storage and email

1. In Azure Portal, select the original Storage account. Under **Security +
   networking → Access keys**, show and copy an existing connection string into
   `AZURE_STORAGE_CONNECTION_STRING`. This application's current storage driver
   expects a connection string. Do not create a new account just to recover the
   file: existing uploads belong to the original account/containers.
2. Set `FILESYSTEM_DISK=azure`, restore `AZURE_STORAGE_CONTAINER` and any original
   prefix/custom URL. For enabled private chat media, restore its private
   container and optional separate connection string. Keep media disabled until
   storage and worker readiness is confirmed; see the Docker README.
3. Sign in to your existing email provider. Retrieve its SMTP credentials or
   create a replacement SMTP credential, verify the sending domain/address, and
   set `MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`,
   `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME`.
4. Match `MAIL_SCHEME` to the provider: typically `smtp` on port 587 with
   STARTTLS, or `smtps` on port 465. The current mail config reads `MAIL_SCHEME`;
   setting only the legacy `MAIL_ENCRYPTION` is insufficient. Empty mailer
   configuration falls back to logs and will not deliver recovery emails.

See [Azure access keys](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-keys-manage)
and [connection strings](https://learn.microsoft.com/en-us/azure/storage/common/storage-configure-connection-string).
Optional bootstrap credentials are for deliberate initial seeding; recovering
this file does not require reseeding existing production accounts.

## 7. Clear the deployment blocker and deploy

Close any editor still using `.env.production`. If a stale Vim swap file remains
and no recovery from it is needed, remove only that file:

```sh
rm -f -- docker/..env.production.swp
git status --short
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml config --quiet
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml up -d --build
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml ps
```

`config --quiet` checks Compose configuration without printing expanded secrets;
it does not prove credentials are valid. The updated workflow ignores the known
environment swap filename and still rejects other checkout changes. Removing
the stale swap once lets an older VM checkout receive that update. Rerun the
GitHub deployment after restoring the file. Redeploy the frontend separately
after changing its build variables. Verify API login, delivered email, access
to existing uploads and Fleet monitoring with authorized accounts.

Store a restricted backup of the completed file in your team's approved secret
store. Keep recovery snapshots private and remove them after confirming a
secure backup. GitHub's deployment SSH secrets cannot reconstruct application
secrets; the workflow intentionally does not receive this environment file.
