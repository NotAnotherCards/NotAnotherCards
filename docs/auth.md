# Authentication Setup

This document describes the authentication system integrated into **NotAnotherCards**.

## Stack & Libraries

Authentication is powered by **Better Auth** (v1.6+).

- **Database Adapter:** Drizzle ORM is used with the `drizzleAdapter` connecting directly to PostgreSQL.
- **Client Integration:** The React frontend uses `@better-auth/react` to communicate with the NestJS API endpoints.
- **Session Strategy:** Secure, HTTP-only, and SameSite-lax cookie-based sessions.

## Backend Architecture

Better Auth is encapsulated within its own NestJS module (`AuthModule`) located in `apps/api/src/auth/`:

1. **`AuthService`**: Dynamic initialization of Better Auth using the injected Drizzle database pool. Defines custom user schema fields (`firstName` and `lastName`) and configures options like `secret` and `baseURL`.
2. **`AuthController`**: Catches all requests directed to `/api/auth/*` (`@All('*')`) and forwards them to Better Auth's standard handler via the `toNodeHandler` bridge from `better-auth/node`.
3. **`AuthModule`**: Imports `DatabaseModule` for the Drizzle connection token, registers/exports `AuthService` and `AuthController`.

## Environment Variables

Ensure your `apps/api/.env` contains the correct variables:

```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/notanothercards
BETTER_AUTH_SECRET=your-base64-random-secret
BETTER_AUTH_URL=http://localhost:3000
```

## API Endpoints

Better Auth registers these standard endpoints automatically at `/api/auth/`:

| Method | Endpoint Path             | Payload                                    | Description                               |
| :----- | :------------------------ | :----------------------------------------- | :---------------------------------------- |
| `POST` | `/api/auth/sign-up/email` | `{ email, password, firstName, lastName }` | Registers a new user                      |
| `POST` | `/api/auth/sign-in/email` | `{ email, password }`                      | Authenticates user & sets session cookies |
| `POST` | `/api/auth/sign-out`      | _None_                                     | Clears the session                        |

## Database Schema

The authentication tables are managed by Drizzle in `apps/api/src/database/schema.ts` and correspond to the official Better Auth schema structure:

- **`user`**: User metadata (includes custom `firstName` and `lastName` columns, `name` is optional).
- **`session`**: Active user sessions mapped to tokens.
- **`account`**: Credentials/Providers mapped to a user.
- **`verification`**: Tokens for password resets and verification flows.

To apply changes or generate migrations, run:

```bash
pnpm db:generate   # generate a migration from schema changes
pnpm db:migrate    # apply pending migrations
```

## CORS & Security

To support local cross-origin credentials exchange between the Vite server (`http://localhost:5173`) and the API server (`http://localhost:3000`), CORS is enabled with `credentials: true` in `main.ts`.
