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

Bootstrap accounts are not seeded automatically on every deployment. If you set
the optional `INITIAL_*` and `APPROVED_CUSTOMER_*` values, run the seeders once
after the stack is healthy:

```sh
compose='docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml'
$compose exec api php artisan db:seed --class=Database\\Seeders\\AdminPermissionSeeder --force
$compose exec api php artisan db:seed --class=Database\\Seeders\\InitialAdminSeeder --force
$compose exec api php artisan db:seed --class=Database\\Seeders\\InitialSellerSeeder --force
$compose exec api php artisan db:seed --class=Database\\Seeders\\InitialCustomerSeeder --force
```

## Automatic deployment from GitHub Actions

The repository workflow at
`.github/workflows/deploy-production-azure-vm.yml` deploys on every push to
`main`. It can also be started manually from the GitHub Actions tab. The job
connects to the VM with OpenSSH, verifies the pinned host key, switches the VM
checkout to `main`, runs `git pull --ff-only origin main`, and executes:

```sh
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml up -d --build
```

The Docker build runs on the Azure VM. GitHub Actions does not receive or copy
`.env.production`; keep that file private on the VM.

### 1. Prepare the Azure VM checkout

The VM needs Git, Docker Engine with the Compose v2 plugin, and a deployment
user that can run Docker. The deployment directory must be a clean checkout of
this repository and must contain the private production environment file:

For a new Ubuntu VM, install Docker Engine and the Compose plugin using
[Docker's Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/)
and [Compose's installation guide](https://docs.docker.com/compose/install/).
Azure's [Linux VM SSH guide](https://learn.microsoft.com/en-us/azure/virtual-machines/linux-vm-connect)
covers the initial VM connection and Network Security Group requirements.

```sh
git --version
docker compose version
sudo mkdir -p /opt/aisley
sudo chown "$USER":"$USER" /opt/aisley
```

The VM's GitHub access is separate from the key GitHub Actions uses to log into
the VM. For a private repository, create a read-only GitHub repository deploy
key on the VM, add its public key under **Repository Settings → Deploy keys**,
leave **Allow write access** disabled, and configure the checkout's `origin` to
use it before cloning. For example:

GitHub documents this [read-only deploy-key setup](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
and recommends a separate key for each repository.

```sh
ssh-keygen -t ed25519 -C "aisley-azure-vm-readonly" -f "$HOME/.ssh/aisley-github-readonly" -N ""
chmod 600 "$HOME/.ssh/aisley-github-readonly"
cat "$HOME/.ssh/aisley-github-readonly.pub"
```

After adding that public key to GitHub, add this host alias to
`~/.ssh/config` and clone using the alias:

```sshconfig
Host github.com-aisley
  HostName github.com
  User git
  IdentityFile ~/.ssh/aisley-github-readonly
  IdentitiesOnly yes
```

```sh
git clone git@github.com-aisley:OWNER/REPOSITORY.git /opt/aisley
```

Skip this extra deploy key if the repository is public and the VM can already
pull it anonymously. Use this command in that case:

```sh
git clone git@github.com:OWNER/REPOSITORY.git /opt/aisley
```

Then prepare the production environment:

```sh
cd /opt/aisley
git switch main
cp docker/.env.production.example docker/.env.production
chmod 600 docker/.env.production
```

Edit `docker/.env.production` with production values and configure the
Cloudflare Tunnel as described in [First deployment](#first-deployment). Test
the checkout and the first build manually before enabling the workflow:

```sh
cd /opt/aisley
git status --short
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml config
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml up -d --build
```

### 2. Create the GitHub Actions → VM SSH key

Create a dedicated Ed25519 key on an administrator workstation. This key is
used only by the deployment workflow, so do not reuse an Azure login key. The
workflow cannot answer an interactive passphrase prompt, so use a dedicated
deployment key without a passphrase and protect it as a GitHub secret:

```sh
ssh-keygen -t ed25519 -C "github-actions-aisley-production" \
  -f "$HOME/.ssh/aisley-actions-azure" -N ""
```

Append the public key to the Azure deployment user's
`~/.ssh/authorized_keys`, or use the Azure portal's **Reset SSH public key**
operation. Then verify that the key works:

```sh
ssh -i "$HOME/.ssh/aisley-actions-azure" \
  azure-user@VM_HOST 'cd /opt/aisley && git status --short'
```

Use a dedicated least-privilege VM user, disable password SSH authentication,
and restrict the key in `authorized_keys` with
`no-agent-forwarding,no-port-forwarding,no-X11-forwarding,no-pty` when those
restrictions fit your VM policy. GitHub-hosted runner IPs are dynamic; if SSH
cannot be restricted to a stable source range, prefer a self-hosted runner or
another private access path rather than exposing more VM services.

### 3. Add repository Actions secrets

In **GitHub → Repository → Settings → Secrets and variables → Actions**, add
these repository secrets:

| Secret | Value |
| --- | --- |
| `AZURE_VM_HOST` | VM public DNS name or IP address |
| `AZURE_VM_USER` | SSH deployment username |
| `AZURE_VM_SSH_PORT` | SSH port; leave unset to use `22` |
| `AZURE_VM_APP_DIR` | Absolute checkout path, for example `/opt/aisley` |
| `AZURE_VM_SSH_PRIVATE_KEY` | Complete private key from `aisley-actions-azure`, including the `BEGIN` and `END` lines |
| `AZURE_VM_SSH_KNOWN_HOSTS` | Verified output of `ssh-keyscan` for the VM host and port |

Populate the known-hosts value only after checking the VM fingerprint through a
trusted channel. On the VM, the fingerprint can be inspected with:

```sh
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On the administrator workstation, collect the host key for the secret (replace
the host and port):

```sh
ssh-keyscan -H -p 22 VM_HOST 2>/dev/null
```

The workflow uses `StrictHostKeyChecking=yes`, so a missing or changed host key
stops the deployment instead of silently trusting a new host.

### 4. Deploy and troubleshoot

Push or merge a commit into `main`. The workflow queues deployments so two
production builds do not run at the same time. A failed VM checkout, failed
fast-forward pull, failed migration, or failed Compose startup fails the job.

The workflow can also be run with **Actions → Deploy production API to Azure VM
→ Run workflow**. Inspect the VM with:

```sh
cd /opt/aisley
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml ps
docker compose --env-file docker/.env.production -f docker/docker-compose.prod.yml logs --tail=100 api migrate queue scheduler nginx cloudflared
```

If a deployment reports local changes, remove or commit only the changes after
confirming they are intentional; the action deliberately refuses to overwrite
the VM checkout. If `git pull` fails, repair the VM's separate GitHub deploy-key
access and verify that `origin` points to the expected repository. Never commit
`docker/.env.production` or put its contents in the workflow file.

## Operations

The Postgres volume is `aisley-production_postgres-data`; back it up before VM or
image upgrades. Do not publish ports `5432`, `8080`, or `9000` on the Azure VM.
The VM needs outbound HTTPS for Cloudflare Tunnel, Azure Blob Storage, and mail.
Restrict Azure inbound access to administration SSH (or Cloudflare Access); the
production stack needs no inbound HTTP or HTTPS rule.
