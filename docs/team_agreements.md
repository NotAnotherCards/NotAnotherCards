# Team Agreements

## Team Roles

| Member | GitHub | Role |
|---------|---------|------|
| Andrei | `@amoiseik` | Product Owner |
| Tanmay | `@tpandya42` | Project Manager |
| Daniel | `@dgomez-a` | Tech Lead |
| Philipp | `@pschneid` | Developer |
| Samuel | `@samcasti` | Developer |

---

## Weekly Meeting

Every Wednesday at **19:30 (Berlin time)**.

---

## Task Management

- We use **GitHub Issues** for all tasks.
- Every feature or bug should have an Issue.
- GitHub Projects is used to organize and track Issues.

---

## Branch Naming

Examples:

- `feature/login-page`
- `feature/spaced-repetition`
- `fix/login-validation`
- `refactor/auth-service`

---

## Commit Messages

We use **Conventional Commits**.

Format:

```text
type(optional-scope): short description
```

Examples:

- `feat(auth): add login page`
- `fix(api): handle expired session`
- `docs: update README`
- `refactor(ui): simplify card component`
- `test(auth): add login tests`
- `chore: update dependencies`

Allowed commit types:

- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation
- `refactor` — code refactoring
- `test` — tests
- `chore` — maintenance

Scope is optional.

---

## Pull Requests

- Create a Pull Request into `main`.
- At least **1 approval** is required before merging.
- All review comments must be resolved.
- Do not push directly to `main`.
- Pull Requests are merged into `main` using **Squash and merge**, so each Pull Request becomes one commit in `main`.
