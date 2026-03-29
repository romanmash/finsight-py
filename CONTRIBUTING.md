# Contributing to FinSight AI Hub

## Project Principles

These principles govern all implementation and review decisions:

1. **Constitution is law** — `.specify/constitution.md` defines non-negotiable boundaries. Agent responsibilities, fail-safe defaults, and cost tracking are enforced in every review.
2. **Spec-driven development** — every feature has a spec (PRD), plan (SDD), and task list in `specs/NNN-feature-name/`. Implementation stays within spec scope.
3. **Everything-as-Code** — behavioral configuration lives in `config/runtime/*.yaml`. If a value affects agent behavior, it must be configurable without code changes.
4. **Test-first where practical** — new behavior requires tests. Tests run offline with mocked APIs.
5. **Practical minimalism** — prefer the smallest correct change over speculative abstraction.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build process, tooling, dependencies |

### Scopes

| Scope | Area |
|---|---|
| `types` | `@finsight/shared-types` package |
| `config` | Config loader, YAML files, Zod schemas |
| `api` | Hono routes, middleware, auth |
| `mcp` | MCP servers or MCP client |
| `agents` | Any of the 9 agents |
| `manager` | Manager agent specifically |
| `kb` | Knowledge Base / Bookkeeper |
| `dashboard` | React admin dashboard |
| `telegram` | Telegram bot |
| `prisma` | Schema, migrations, seed |
| `infra` | Docker, Pulumi, CI/CD, scripts |
| `spec` | Specs directory changes |

### Examples

```
feat(agents): implement Watchdog price scanning with alert creation
fix(config): validate pricing.yaml rates as non-negative
test(kb): add Bookkeeper contradiction detection unit tests
docs(spec): add plan.md for 006-collector-agents
chore(infra): add health check to market-data-mcp container
refactor(api): extract JWT validation into reusable middleware
```

## Branch Naming

| Pattern | When |
|---|---|
| `feature/NNN-short-description` | Implementing a numbered spec (e.g. `feature/001-foundation-config`) |
| `fix/short-description` | Bug fix not tied to a specific spec |
| `docs/short-description` | Documentation-only change |
| `chore/short-description` | Build, tooling, or dependency change |

## Development Workflow

1. **Read** the constitution: `.specify/constitution.md`
2. **Read** the feature catalogue: `specs/README.md` — verify all dependency specs are complete (each must have `plan.md` and `tasks.md` with all items checked)
3. **Read** the feature spec: `specs/NNN-feature-name/spec.md`
4. **Plan** — if `plan.md` does not yet exist, run `/plan NNN-feature-name` to generate it
5. **Read** the implementation plan: `specs/NNN-feature-name/plan.md`
6. **Implement** only the files listed in the plan (use `/implement NNN-feature-name`)
7. **Test** with `pnpm -r test` — all tests must pass offline
8. **Typecheck** with `pnpm -r typecheck` — zero errors
9. **Lint** with `pnpm -r lint` — zero warnings
10. **Commit** using conventional commit format

## Setup

```bash
# Prerequisites: Node.js 20 LTS, pnpm 9
pnpm install                     # Install all workspace dependencies
cp .env.example .env             # Configure environment variables
docker compose up -d postgres redis  # Start database + cache
pnpm prisma migrate dev          # Apply migrations
pnpm prisma db seed              # Load demo data
pnpm -r test                     # Verify everything works
```

## Pull Request Checklist

- [ ] Typecheck passes: `pnpm -r typecheck` (zero errors)
- [ ] Lint passes: `pnpm -r lint` (zero warnings)
- [ ] Tests pass offline: `pnpm -r test` (no network, no Docker)
- [ ] No `any` types, explicit return types on all functions
- [ ] All interfaces and exported functions have JSDoc comments
- [ ] All config from YAML — no hardcoded values
- [ ] Agent boundaries respected — no cross-domain leaks
- [ ] Cost tracking — every LLM call records tokens, cost, duration in `AgentRun`
- [ ] Conventional commit message with appropriate scope
- [ ] Implementation stays within the current spec's scope
