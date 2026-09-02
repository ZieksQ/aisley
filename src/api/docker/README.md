# API production containers

This production API stack runs Laravel PHP-FPM, Nginx, PostgreSQL, the Laravel
queue worker and scheduler, plus a remote-managed Cloudflare Tunnel. Nothing
publishes a host port: Cloudflare Tunnel is the only public ingress.

## First deployment

1. On the Azure VM, clone this repository and copy `.env.production.example` to
   `src/api/.env.production`. Generate a unique application key with
   `php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"` and set it
   as `APP_KEY`. Use strong database and service credentials.
2. In Cloudflare, create a **remote-managed** tunnel and copy its token into
   `CLOUDFLARE_TUNNEL_TOKEN`. In **Networking > Tunnels**, add a Published
   Application route with your hostname (for example `api.example.com`) and
   service URL `http://nginx:8080`. Cloudflare creates the needed DNS record for
   a zone it manages.
3. Replace every `example.com` value in the environment file. `APP_URL` must
   equal the public API URL, and `CORS_ALLOWED_ORIGINS` must list the exact
   frontend origins. `SANCTUM_STATEFUL_DOMAINS` takes the same hosts without
   protocol. If the frontends remain on `*.vercel.app`, use those exact origins
   and set `SESSION_SAME_SITE=none`; `SESSION_SECURE_COOKIE=true` is required.
4. Start the stack from the repository root:

   ```sh
   docker compose --env-file src/api/.env.production -f docker.prod.yml up -d --build
   ```

The `migrate` container runs `php artisan migrate --force` and must complete
before the API, worker, and scheduler start. View startup and tunnel health with
`docker compose --env-file src/api/.env.production -f docker.prod.yml logs -f`.

## Operations

The Postgres volume is named `aisley-production_postgres-data`; back it up before
upgrading the VM or Docker images. Do not expose ports `5432`, `8080`, or `9000`
on the VM. The VM instead needs outbound HTTPS connectivity for Cloudflare Tunnel,
Azure Blob Storage, and mail delivery. Restrict the Azure network security group
to SSH from your administration IP (or use Cloudflare Access); no inbound HTTP or
HTTPS rule is needed for this stack.

For updates, pull the new code and run the same `up -d --build` command. Docker
Compose reruns migrations; Laravel migrations are idempotently tracked.
