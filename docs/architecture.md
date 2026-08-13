# System Architecture

## System Overview
The application consists of three major components:

```
React Frontend 
↓
Laravel Backend (REST API) 
↓
Supabase (PostgreSQL)
```

The frontend is responsible for the user interface.
The API handles authentication, validation, and business logic.
Supabase (PostgreSQL) stores persistent application data.

## Project Structure
- for the main components store it in `/src`
```bash
.github/
src/
|- webapp/
|- api/
|- ...
docs/
README.md
docker-compose.yml
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## Package Manager
- pnpm
- use pnpm workspace then the four main project `webapp`, `seller`, `admin`, and `api`
- use concurrently for development to run this project in one command

## Frontend Structure
The frontend consist of 3 different react projects;
`webapp`, `seller`, and `admin`.

- **webapp** - this is the main domain, used by buyer and guests (unauthenticated users)
to browse, add to cart, order products.
- **seller** - domain for sellers. register as a seller, create a store, list new products,
manage orders, analytics, and inventory.
- **admin** - domain for application admin. analytics, manage sellers application, manage tax,
customer service.


### Stack per frontend
**webapp** - SSR + CSR
- Next js (default configuration)
- React + TypeScript
- Tailwind
- React Icons

**seller** & **admin**
- React + TypeScript
- Tailwind
- React Icons

## Backend Structure
- Laravel
- use `laravel` command when creating laravel project.
- use `php` and `composer` commands when needed.
- uses Laravel API.
- Eloquent API.
- Laravel Sanctum for token-based authentication.

## Database Structure
- Supabase
- Can switch between Supabase and local PostgreSQL for development by changing database in `.env`.