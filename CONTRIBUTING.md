# Contributing to FinSight AI Hub

## Project Principles

These principles govern all implementation and review decisions:

1. **Constitution is law** — `.specify/memory/constitution.md` defines non-negotiable boundaries. Agent responsibilities, fail-safe defaults, and cost tracking are enforced in every review.
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
| `shared` | Shared Python package |
| `config` | Config loader, YAML files, Pydantic schemas |
| `api` | FastAPI routes, middleware, auth |
| `mcp` | MCP servers or MCP client |
| `agents` | Any of the 9 agents |
| `manager` | Manager agent specifically |
| `kb` | Knowledge Base / Bookkeeper |
| `dashboard` | Dash operator dashboard |
| `telegram` | Telegram bot |
| `db` | SQLAlchemy models and Alembic migrations |
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

1. **Read** the constitution: `.specify/memory/constitution.md`
2. **Read** the feature catalogue: `specs/README.md` — verify all dependency specs are complete (each must have `plan.md` and `tasks.md` with all items checked)
3. **Read** the feature spec: `specs/NNN-feature-name/spec.md`
4. **Plan** — if `plan.md` does not yet exist, run `/plan NNN-feature-name` to generate it
5. **Read** the implementation plan: `specs/NNN-feature-name/plan.md`
6. **Implement** only the files listed in the plan (use `/implement NNN-feature-name`)
7. **Test** with `uv run pytest` — all tests must pass offline
   Default capture mode is `--capture=sys` (configured in `pyproject.toml`).
   If Codex sandbox hangs in WSL2, use `danger-full-access` mode:
   use `.codex/config.toml` (repo-local), and if needed mirror the same settings in `~/.codex/config.toml`, then restart VS Code/Codex.
8. **Typecheck** with `uv run mypy --strict` — zero errors (required)
9. **Lint** with `uv run ruff check` — zero warnings (required)
10. **Commit** using conventional commit format

## Quality Gates

Run these before committing:

```bash
uv run mypy --strict
uv run ruff check
uv run pytest
```

## Setup

```bash
# Prerequisites: Python 3.13, uv
uv sync                          # Install all workspace dependencies
source "$HOME/.local/bin/env"    # Ensure uv is on PATH (or export PATH="$HOME/.local/bin:$PATH")
cp .env.example .env             # Configure environment variables
docker compose up -d db redis        # Start database + cache
uv run alembic upgrade head      # Apply migrations
uv run python -m api.seeds.seed  # Load demo data
uv run pytest                    # Verify everything works
```

## Git Hooks

Install repo-managed hooks once per clone:

```bash
bash scripts/setup-git-hooks.sh
```

Installed hooks:

- `pre-commit`: `ruff`, `mypy`, `pytest` via `.codex/hooks/python-quality-check.sh`
- `pre-push`: `pytest` via `.codex/hooks/python-pytest-check.sh`

Hook notes:

- Hooks auto-heal missing `.venv` dependencies with `uv sync --all-packages --group dev`.
- On sync failure, hooks clear uv cache and retry once with `--refresh`.
- Windows/WSL mixed workflows are supported via OS-specific uv caches (`.cache/uv-win` and `.cache/uv-linux`).

## Debug MCP

Start debug server:

```bash
docker compose --profile debug up -d debug-mcp
curl -s http://localhost:8010/health
```

Related config:

- Codex MCP registration: `.vscode/mcp.json`
- Claude MCP registration: `.claude/settings.json`
- Browser MCP uses compose network `finsight_default` (adjust if your compose project name differs)
- WSL2 Docker wrapper: `bash scripts/docker-auto.sh ...`

## Versioning and Releases

- Single source of truth: `[project].version` in `pyproject.toml`
- GitHub-visible version: annotated git tag `vX.Y.Z` (and optional GitHub release)
- Release notes source: `CHANGELOG.md`

Required release sequence:

1. Bump `[project].version` in `pyproject.toml`
2. Add/update matching changelog header in `CHANGELOG.md`:
   `## [X.Y.Z] - YYYY-MM-DD`
3. Run release validation/tagging script:

```bash
bash scripts/release.sh --dry-run
bash scripts/release.sh --push
# optional, if gh CLI is configured:
bash scripts/release.sh --push --github-release
```

`scripts/release.sh` enforces changelog/version alignment and will fail if:

- working tree is dirty
- tag already exists
- changelog entry for `X.Y.Z` is missing or empty

## Pull Request Checklist

- [ ] Typecheck passes: `uv run mypy --strict` (zero errors)
- [ ] Lint passes: `uv run ruff check` (zero warnings)
- [ ] Tests pass offline: `uv run pytest` (no network, no Docker)
  - Default capture mode is `--capture=sys` from `pyproject.toml`
  - If running via Codex sandbox in WSL2, use `danger-full-access` mode from `.codex/config.toml`
- [ ] Explicit return types on all Python functions
- [ ] All config from YAML — no hardcoded values
- [ ] Agent boundaries respected — no cross-domain leaks
- [ ] Cost tracking — every LLM call records tokens, cost, duration in `AgentRun`
- [ ] Conventional commit message with appropriate scope
- [ ] Implementation stays within the current spec's scope
