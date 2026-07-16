# Milestone 1 - Authentication and user accounts

## M1-01 - Define the auth database schema

Owner suggestion: backend person

Type: Backend / Database

### Goal

Create the database tables needed by Better Auth and the basic user account model.

### Stack

- Drizzle ORM
- PostgreSQL
- Better Auth Drizzle adapter

### Tasks

- Read Better Auth Drizzle adapter docs.
- Decide whether Better Auth will generate the auth schema or whether we define it manually with Drizzle.
- Add auth-related tables to the Drizzle schema.
- Add any app-specific user profile fields needed.
- Generate and run the migration.
- Document the resulting tables in `docs/database.md`.

### Minimum tables/concepts

Better Auth may need tables such as:

- `user`
- `session`
- `account`
- `verification`

Depending on the Better Auth configuration, names can differ. Do not invent a separate auth schema unless Better Auth requires it.

For our app-specific user profile, keep it minimal:

- `id`
- `name`
- `email`
- `emailVerified`
- `image/avatar` optional
- `createdAt`
- `updatedAt`

### Acceptance criteria

- Auth tables exist in Drizzle schema.
- Migration runs successfully.
- PostgreSQL contains the expected tables.
- Backend can import the schema without errors.
- `docs/database.md` explains the auth tables briefly.
- `.env.example` contains required database/auth variables.

### Useful docs

- Better Auth Drizzle adapter
- Drizzle migrations
- Drizzle PostgreSQL guide

## M1-02 - Integrate Better Auth into NestJS

Owner suggestion: backend person

Type: Backend / Auth

Depends on: M1-01

### Goal

Make the NestJS backend expose working Better Auth endpoints.

### Stack

- NestJS
- Better Auth
- Drizzle adapter
- PostgreSQL

### Tasks

- Create auth configuration file in `apps/api`.
- Configure Better Auth with Drizzle/PostgreSQL.
- Register Better Auth endpoints inside NestJS.
- Configure CORS so the Vite frontend can call the auth endpoints.
- Configure cookies/session behavior for local development.
- Add environment variables to `.env.example`.
- Add a simple `/health` endpoint.

### Recommended file structure

```text
apps/api/src/auth/
  auth.ts
  auth.module.ts
  auth.controller.ts or better-auth route bridge
  auth.service.ts if needed
```

Keep it simple. Do not over-engineer with custom guards before the basic auth flow works.

### Required environment variables

Example names:

```text
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

### Acceptance criteria

- Backend starts without errors.
- Better Auth endpoints are reachable.
- User registration works through an HTTP request.
- Login works through an HTTP request.
- A session cookie/token is created correctly.
- CORS allows the frontend dev server.
- Auth setup is documented in `docs/auth.md`.

### Tests

Use:

- Jest
- Supertest

Minimum tests:

- POST register/signup creates a user.
- Duplicate email returns an error.
- POST login/signin works with correct credentials.
- POST login/signin fails with wrong password.

Exact endpoint paths depend on Better Auth configuration, so the ticket owner should document the final routes in `docs/auth.md`.

### Useful docs

- Better Auth NestJS integration
- Better Auth PostgreSQL schema generation/migration docs
- NestJS authentication overview
- NestJS testing docs

## M1-03 - Create shared auth validation schemas

Owner suggestion: shared/frontend or backend person

Type: Shared package

### Goal

Create reusable Zod schemas for login, registration, and basic user profile data.

### Stack

- Zod
- `packages/schemas`

### Tasks

Create:

- `packages/schemas/src/auth.ts`
- `packages/schemas/src/index.ts`

### Acceptance criteria

- `registerSchema` exists.
- `loginSchema` exists.
- Types are exported.
- Frontend can import the schemas.
- Backend can import the schemas if needed.
- Invalid data fails validation in unit tests.

### Tests

Minimum tests:

- Valid register input passes.
- Invalid email fails.
- Too-short password fails.
- Empty login password fails.

### Useful docs

- Zod introduction

## M1-04 - Set up frontend routing and auth route structure

Owner suggestion: frontend person

Type: Frontend / Routing

### Goal

Create the first real route structure with public auth routes and protected app routes.

### Stack

- React
- Vite
- TanStack Router

### Tasks

- Create a public layout.
- Create auth layout.
- Create a protected app layout.
- Add placeholder login/register/dashboard pages.
- Add redirect behavior later once auth state exists.

### Acceptance criteria

- `/login` renders login page placeholder.
- `/register` renders register page placeholder.
- `/app/dashboard` renders dashboard placeholder.
- Routes are type-safe and generated correctly.
- Navigation links work.

### Tests

Use:

- Vitest

Minimum tests:

- Login route renders.
- Register route renders.
- Dashboard route renders placeholder before auth protection is implemented.

### Useful docs

- TanStack Router overview
- TanStack Router quick start

## M1-05 - Create shared UI form components

Owner suggestion: frontend

Type: Frontend / UI

### Goal

Create reusable auth form building blocks so login and registration look consistent.

### Stack

- Tailwind
- shadcn/ui
- React Hook Form
- Zod

shadcn/ui has official Vite installation docs, and its form docs show React Hook Form with Zod validation. React Hook Form's resolver package supports external validation libraries such as Zod.

### Components to add

Use shadcn/ui components:

- Button
- Input
- Label
- Card
- Form
- Alert

Create app-specific wrappers if needed:

- AuthCard
- AuthPageLayout
- FormErrorMessage
- PasswordInput

### Acceptance criteria

- Auth pages use reusable components.
- Components are keyboard-accessible.
- Error messages are visible and readable.
- Loading/disabled button state exists.

### Tests

Use:

- Vitest

Minimum tests:

- FormErrorMessage renders text.
- PasswordInput can toggle visibility if implemented.
- AuthCard renders titles and children.

### Useful docs

- shadcn/ui Vite docs
- shadcn/ui React Hook Form docs
- React Hook Form docs

## M1-06 - Build registration page

Owner suggestion: frontend person

Type: Frontend / Auth

Depends on: M1-03, M1-04, M1-05, M1-02

### Goal

Allow a new user to create an account from the frontend.

### Stack

- React
- Vite
- TanStack Router
- React Hook Form
- Zod
- shadcn/ui
- Better Auth client

### Page behavior

Route: `/register`

Fields:

- name
- email
- password
- confirm password

Actions:

- submit registration
- show validation errors
- show backend errors
- redirect to `/app/dashboard` or `/login` after success

### Tasks

- Build the register form using React Hook Form.
- Use `registerSchema` from `packages/schemas`.
- Connect form to Better Auth client.
- Show loading state.
- Show errors from frontend validation.
- Show errors from backend/auth response.
- Redirect after successful registration.

### Acceptance criteria

- Users can create an account from `/register`.
- Invalid email shows validation error before request.
- Short password shows validation error before request.
- Duplicate email shows backend error.
- Successful registration creates a user in DB.
- Successful registration redirects correctly.

### Tests

Frontend unit/component tests:

- Register form renders all fields.
- Invalid email shows an error.
- Too-short password shows an error.
- The submit button is disabled or shows loading while submitting.
- Backend error is displayed.

### Useful docs

- React Hook Form useForm docs
- shadcn/ui forms with Zod
- Better Auth docs

## M1-07 - Build login page

Owner suggestion: frontend person

Type: Frontend / Auth

Depends on: M1-03, M1-04, M1-05, M1-02

### Goal

Allow existing users to log in from the frontend.

### Stack

- React
- Vite
- TanStack Router
- React Hook Form
- Zod
- shadcn/ui
- Better Auth client

### Page behavior

Route: `/login`

Fields:

- email
- password

Actions:

- submit login
- show validation errors
- show wrong credentials error
- redirect to `/app/dashboard` after success

### Acceptance criteria

- Users can log in from `/login`.
- Wrong password shows friendly error.
- Successful login redirects to `/app/dashboard`.
- Session survives page refresh.
- Already logged-in user visiting `/login` is redirected to `/app/dashboard`.

### Tests

Frontend tests:

- Login form renders.
- Invalid email shows error.
- Empty password shows error.
- Wrong credentials error is displayed.
- Successful submit calls the auth function.

Backend/Supertest tests should already cover the API side, but add one full login test if missing:

- Register user.
- Login with same credentials.
- Confirm session/cookie exists.

### Useful docs

- React Hook Form docs
- shadcn/ui React Hook Form docs
- Better Auth NestJS integration

## M1-08 - Implement auth state and protected routes

Owner suggestion: frontend person

Type: Frontend / Auth

Depends on: M1-06, M1-07

### Goal

Only logged-in users can access `/app/*`.

### Stack

- TanStack Router
- Better Auth client
- React

### Behavior

Logged out:

- `/app/dashboard` redirects to `/login`

Logged in:

- `/login` redirects to `/app/dashboard`
- `/register` redirects to `/app/dashboard`
- `/app/dashboard` renders

### Tasks

- Create an auth client helper.
- Create a hook/helper for the current session.
- Add protected route logic to app layout.
- Add the loading state while the session is being checked.
- Add redirect behavior.

### Acceptance criteria

- The protected dashboard is inaccessible when logged out.
- Logged-in session survives refresh.
- No broken flicker where protected content appears before redirection.
- Auth loading state is visible when needed.

### Tests

Frontend tests:

- Logged-out users are redirected from dashboard to login.
- Logged-in users can see the dashboard.
- Logged-in users are redirected away from the login page.

If route-level tests become awkward, leave detailed route behavior to Playwright and test the smaller auth helper functions with Vitest.

### Useful docs

- TanStack Router overview

## M1-09 - Build basic authenticated dashboard

Owner suggestion: frontend

Type: Frontend

Depends on: M1-08

### Goal

Create the first protected page after login.

### Stack

- React
- Tailwind
- shadcn/ui
- TanStack Router
- Better Auth client

### Acceptance criteria

- Dashboard only renders for logged-in users.
- Shows current user name or email.
- Has clear placeholders for future features.
- Layout looks usable on desktop and mobile.

### Tests

- Dashboard renders welcome text.
- Dashboard shows user email/name.
- Dashboard has placeholder cards for future sections.

## M1-10 - Implement logout

Owner suggestion: frontend + backend

Type: Full stack

Depends on: M1-07, M1-08

### Goal

Allow logged-in users to end their session.

### Stack

- Better Auth
- React
- TanStack Router
- NestJS

### Behavior

- User clicks logout.
- Session is invalidated.
- User is redirected to `/login`.
- `/app/dashboard` becomes inaccessible.

### Acceptance criteria

- The logout button exists in a protected layout.
- Logout invalidates the session.
- User is redirected to `/login`.
- Refresh after logout keeps the user logged out.

### Tests

Frontend:

- Clicking logout calls the logout function.
- The user is redirected after logout.

Backend/Supertest:

- Authenticated request works before logout.
- Logout endpoint clears/invalidates session.
- Protected request fails after logout.
