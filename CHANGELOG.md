# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-04-28

### Added

- GitHub release automation now creates release body from the matching
  `CHANGELOG.md` section for pushed tags (`v*`).

### Changed

- CI workflow now uses `actions/setup-python@v5` for Python provisioning,
  keeps `astral-sh/setup-uv@v3` for uv setup, and syncs with `--group dev`.
- Fixed strict mypy fixture annotation in
  `apps/mcp-servers/rag-retrieval/tests/test_rag_tools.py`.

## [0.1.1] - 2026-04-28

### Changed

- `scripts/release.sh` now resolves Python runtime in this order:
  `uv run python`, then `python3`, then `python`.
- Release/tag workflow docs were split professionally:
  concise pointer in `README.md` and full process in `CONTRIBUTING.md`.

## [0.1.0] - 2026-04-28

### Added

- Initial version marker for the workspace in `pyproject.toml`.
