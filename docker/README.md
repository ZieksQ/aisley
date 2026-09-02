# Production API Docker deployment

All production-container configuration lives in this directory:

```text
docker/
├── api/                         # PHP-FPM image, PHP limits, build exclusions
├── nginx/                       # Nginx image and Cloudflare-aware FastCGI config
├── .env.production.example      # Private production environment template
└── docker-compose.prod.yml      # Service wiring only
```

`docker-compose.prod.yml` orchestrates independent API, Nginx, Postgres, queue,
scheduler, and Cloudflare Tunnel services. It contains no Dockerfile or Nginx
configuration. The API image builds from `src/api` without copying application
secrets, development dependencies, test files, or local storage.

## First deployment

1. On the Azure VM, copy `.env.production.example` to `.env.production` in this
   directory. Generate an application key with
   `php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"`, set it as
   `APP_KEY`, and replace every placeholder with production credentials.
2. In Cloudflare, create a **remote-managed** tunnel and set
   `CLOUDFLARE_TUNNEL_TOKEN`. In **Networking > Tunnels**, add a Published
   Application route for your custom API name (for example `api.example.com`) to
   service URL `http://nginx:8080`. Cloudflare creates the DNS route for a zone
   it manages.
3. Set `APP_URL` to that API hostname. Set `CORS_ALLOWED_ORIGINS` to the exact
   browser origins that call the API, and set `SANCTUM_STATEFUL_DOMAINS` to those
   host names without protocols. For Vercel `*.vercel.app` frontends, set
   `SESSION_SAME_SITE=none`; retain `SESSION_SECURE_COOKIE=true`.
4. From the repository root, start the stack:

   ```sh
   docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml up -d --build
   ```

The `migrate` service runs `php artisan migrate --force` before the API, queue,
and scheduler start. Follow startup and tunnel health with:

```sh
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml logs -f
```

## Operations

The Postgres volume is `aisley-production_postgres-data`; back it up before VM or
image upgrades. Do not publish ports `5432`, `8080`, or `9000` on the Azure VM.
The VM needs outbound HTTPS for Cloudflare Tunnel, Azure Blob Storage, and mail.
Restrict Azure inbound access to administration SSH (or Cloudflare Access); the
production stack needs no inbound HTTP or HTTPS rule.
