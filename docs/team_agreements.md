# Team Agreements

## Team Roles

| GitHub | Role |
|---------|------|
| `@devriez` | Product Owner / developer |
| `@tpandya42` | Project Manager support / developer |
| `@Danielg1406` | Tech Lead / developer |
| `@dustyway` | Developer |
| `@samsnwn` | Developer |

In project documents, we use GitHub nicknames instead of real names.

---

## Weekly Meeting

Every Wednesday at **19:30 (Berlin time)**.

- We try to attend meetings in person at the school whenever possible.
- If someone cannot attend in person, they should join online instead.

---

## Task Management

- GitHub is our single source of truth for project documentation and task tracking.
- We use **GitHub Issues** for all tasks.
- Non-programming tasks are also tracked as GitHub Issues.
- Every feature or bug should have an Issue.
- GitHub Projects is used to organize and track Issues.
- For now, `@devriez` and `@tpandya42` share Project Manager responsibilities.
- When someone starts a milestone task, they should post a short update in the team chat.

---

## GitHub Project Workflow

Project statuses:

- `Backlog` — task exists, but is not ready to start yet.
- `Todo` — task is ready to be picked up.
- `In Progress` — someone is actively working on it.
- `Review` — implementation is done and waiting for review or Pull Request review.
- `Blocked` — task cannot continue until something is resolved.
- `Done` — task is completed.

---

## Labels and Issue Types

Labels:

- `frontend`
- `backend`
- `database`
- `auth`
- `docs`
- `testing`
- `product`
- `management`
- `setup`

Issue types:

- `Feature` — new user-facing or technical functionality.
- `Task` — documentation, setup, planning, management, or internal work.
- `Bug` — incorrect behavior that needs to be fixed.

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
