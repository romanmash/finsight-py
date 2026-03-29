# FinSight AI Hub — Specs Index

> **Methodology:** GitHub [Spec-Driven Development](https://github.com/github/spec-kit)
> **Constitution:** [`.specify/constitution.md`](../.specify/constitution.md)
> **Source Documents:** [`docs/CASE.md`](../docs/CASE.md) · [`docs/CONTEXT.md`](../docs/CONTEXT.md)

## Feature Catalogue

Each feature directory contains three artifacts:

| Artifact | Purpose | Phase |
|---|---|---|
| `spec.md` | PRD — User stories, acceptance scenarios, requirements | Specify |
| `plan.md` | SDD — Technical design, file list, architecture decisions | Plan |
| `tasks.md` | Implementation checklist grouped by user story | Implement |

## Build Order

Features are ordered by dependency. Implement them in sequence.

| # | Feature | Directory | Dependencies | Spec | Plan | Tasks |
|---|---|---|---|---|---|---|
| 001 | Foundation & Config | [`001-foundation-config/`](./001-foundation-config/) | — | ✅ | — | — |
| 002 | Data Layer | [`002-data-layer/`](./002-data-layer/) | 001 | ✅ | — | — |
| 003 | API & Auth | [`003-api-auth/`](./003-api-auth/) | 001, 002 | ✅ | — | — |
| 004 | MCP Platform | [`004-mcp-platform/`](./004-mcp-platform/) | 001, 002 | ✅ | — | — |
| 005 | Agent Infrastructure | [`005-agent-infrastructure/`](./005-agent-infrastructure/) | 003, 004 | ✅ | — | — |
| 006 | Collector Agents | [`006-collector-agents/`](./006-collector-agents/) | 004, 005 | ✅ | — | — |
| 007 | Reasoning Agents | [`007-reasoning-agents/`](./007-reasoning-agents/) | 005, 006 | ✅ | — | — |
| 008 | Orchestration | [`008-orchestration/`](./008-orchestration/) | 006, 007 | ✅ | — | — |
| 009 | Telegram Bot | [`009-telegram-bot/`](./009-telegram-bot/) | 008 | ✅ | — | — |
| 010 | Admin Dashboard | [`010-admin-dashboard/`](./010-admin-dashboard/) | 003, 008 | ✅ | — | — |
| 011 | Seed & Infrastructure | [`011-seed-infrastructure/`](./011-seed-infrastructure/) | All above | ✅ | — | — |

## Legend

| Icon | Meaning |
|---|---|
| ✅ | Artifact complete |
| 🔨 | In progress |
| — | Not yet started |
