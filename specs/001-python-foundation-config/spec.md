# Feature Specification: Foundation & Config

**Feature Branch**: `001-python-foundation-config`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Project Boots from Scratch (Priority: P1)

A developer clones the repository, copies `.env.example` to `.env`, and starts the system. Within
moments the API is reachable, the database connection is verified, and all configuration files have
been validated. The developer does not need to manually wire configuration — the system reads,
validates, and applies all YAML config files automatically at startup.

**Why this priority**: Every other feature depends on the system being able to start. This is the
single most critical story — without it nothing else works.

**Independent Test**: Clone the repo, run setup commands, start the API, confirm the health
endpoint responds and reports all subsystems as ready.

**Acceptance Scenarios**:

1. **Given** a fresh clone with a valid `.env` file and all config YAML files present, **When** the
   developer starts the API, **Then** the system starts successfully and the health endpoint returns
   a healthy status within 5 seconds.
2. **Given** the system is starting, **When** it reads all YAML files in `config/runtime/`, **Then**
   each file is validated against its schema and any structural errors are reported immediately.
3. **Given** a `.env` file with a required variable missing, **When** the system starts, **Then**
   startup is aborted with a clear error message naming the missing variable before any network
   connections are attempted.

---

### User Story 2 — Invalid Config Fails Fast (Priority: P1)

A developer accidentally introduces a typo or wrong value into a YAML config file. When starting
the system, they receive an immediate, precise error message telling them exactly which file,
which field, and what value was rejected — before any agent or service begins running.

**Why this priority**: Misconfiguration that silently starts and fails later is dangerous in a
multi-agent system. Fail-fast at startup is a safety guarantee.

**Independent Test**: Introduce a deliberate schema violation in a config YAML file, attempt
startup, and verify a descriptive error is produced and the process exits immediately.

**Acceptance Scenarios**:

1. **Given** a YAML config file with a field set to an invalid type (e.g., a string where a number
   is expected), **When** the system starts, **Then** startup aborts with an error that includes
   the file name, field path, and the nature of the violation.
2. **Given** a YAML config file with a required field omitted, **When** the system starts, **Then**
   startup aborts with an error naming the missing field.
3. **Given** all config files are valid, **When** the system starts, **Then** no config-related
   errors are produced and startup continues normally.

---

### User Story 3 — Developer Runs the Full Test Suite Offline (Priority: P2)

A developer runs all project tests on their laptop without network access, without Docker running,
and without a database server. All tests pass. The test runner produces a clear, structured report.

**Why this priority**: Offline testing is a hard project constraint. The test infrastructure must
work from day one so every subsequent feature can be tested in the same way.

**Independent Test**: Disconnect from network, stop any running containers, run the test command,
and verify all tests pass with a clean report.

**Acceptance Scenarios**:

1. **Given** no network access and no running external services, **When** the developer runs the
   test suite, **Then** all tests pass and results are displayed per-module.
2. **Given** the test suite runs, **When** a test touches configuration loading, **Then** it uses
   in-process fixtures rather than real files or environment variables from the host.

---

### User Story 4 — Developer Starts Local Infrastructure with One Command (Priority: P2)

A developer runs a single command to bring up the local development environment: database
(with vector search support), cache, and any other required backing services. The environment is
ready for API development within two minutes.

**Why this priority**: Fast local setup reduces friction for all subsequent feature development.

**Independent Test**: Run the single setup command on a clean machine, wait for services to report
healthy, then confirm the API can reach the database and cache.

**Acceptance Scenarios**:

1. **Given** a container runtime is available, **When** the developer runs the local infrastructure
   command, **Then** the database, cache, and supporting services are accessible within two minutes.
2. **Given** the local infrastructure is running, **When** database migrations are applied, **Then**
   the schema is created without errors.

---

### Edge Cases

- What happens when a YAML config file is syntactically invalid (unparseable)?
- How does the system behave if `config/runtime/` is empty or missing entirely?
- What if the `.env` file contains extra unknown variables not in the schema?
- What if two config files define conflicting values for the same logical setting?
- What if the database is reachable but migrations have not been run?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST validate all YAML configuration files at startup before any service
  or agent initialises.
- **FR-002**: The system MUST abort startup and print a precise error (file name, field path,
  violation description) if any configuration file fails schema validation.
- **FR-003**: The system MUST expose a health endpoint that reports the readiness status of all
  required subsystems (database, cache, config) individually.
- **FR-004**: The system MUST load secrets exclusively from environment variables; secrets MUST
  NOT appear in YAML configuration files.
- **FR-005**: The system MUST emit structured, machine-readable logs for all startup events,
  configuration load outcomes, and subsystem health checks.
- **FR-006**: The project MUST be organised as a multi-package monorepo so that domain models,
  API code, and configuration schemas are independent units that can be tested separately.
- **FR-007**: The system MUST include a database migration tool that applies schema changes in a
  repeatable, version-controlled manner.
- **FR-008**: The test suite MUST run fully offline without any running external services or
  network access.
- **FR-009**: The local development environment MUST be startable with a single command and include
  at minimum a relational database with vector search support and a cache service.
- **FR-010**: All configuration values that govern system behaviour MUST be settable via YAML
  files without modifying source code.
- **FR-011**: A `.env.example` file MUST document every required environment variable with a
  description and placeholder value.

### Key Entities

- **ConfigFile**: A named YAML file within the runtime configuration directory. Has a schema
  version, a set of validated fields, and a clear owner (which subsystem reads it).
- **HealthStatus**: A point-in-time report of subsystem readiness. Covers database, cache, and
  configuration validity. Each subsystem reports independently.
- **EnvironmentConfig**: The complete set of secret and environment-specific values sourced only
  from environment variables. Distinct from YAML config — never stored in files committed to source
  control.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The system starts within 5 seconds on the target hardware given valid configuration
  and running backing services.
- **SC-002**: An invalid configuration file causes startup to abort within 1 second with a message
  precise enough for a developer to locate and fix the problem without additional debugging.
- **SC-003**: The full test suite completes in under 60 seconds in an offline environment with no
  external services running.
- **SC-004**: Bringing up the local development environment takes under 2 minutes from a cold
  start on hardware matching the project's target server.
- **SC-005**: Zero configuration-related errors occur during normal startup when all required YAML
  files and environment variables are present and valid.
- **SC-006**: Every configuration field that affects system or agent behaviour is documented and
  changeable without modifying source code.

## Assumptions

- The developer has a compatible container runtime available for local infrastructure setup.
- The `uv` package manager and Python 3.13 are installed on the developer's machine before setup.
- All secrets (API keys, database passwords, tokens) are provided via `.env`; the `.env.example`
  file lists every required variable with a safe placeholder.
- The `config/runtime/` directory ships with working default values for all non-secret settings so
  the system can start with minimal manual configuration.
- Vector search support in the local database is required from the start, as the RAG layer (a
  later feature) depends on it being available.
- Unknown or extra environment variables in `.env` are ignored silently — only documented required
  variables are validated.
- The test infrastructure approach (fixtures, stubs, in-process mocking) is determined during the
  planning phase within the offline constraint; this spec does not prescribe the mechanism.
