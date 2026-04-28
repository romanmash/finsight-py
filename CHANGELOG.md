# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-04-28

### Changed

- `scripts/release.sh` now resolves Python runtime in this order:
  `uv run python`, then `python3`, then `python`.
- Release/tag workflow docs were split professionally:
  concise pointer in `README.md` and full process in `CONTRIBUTING.md`.

## [0.1.0] - 2026-04-28

### Added

- Initial version marker for the workspace in `pyproject.toml`.
