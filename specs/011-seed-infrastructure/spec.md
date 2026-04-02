# Feature Specification: Seed & Infrastructure

**Feature Branch**: `011-seed-infrastructure`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer Deploys the Full System to the Linux Server with One Script (Priority: P1)

A developer runs the deployment script from their Windows laptop. The script transfers updated
source files to the Linux server over SSH, rebuilds the containers, and restarts all services.
The system is running the new version within five minutes. The developer does not need to manually
SSH in and issue commands.

**Why this priority**: Deployment automation is the last step before the system is usable in
production. All features are useless without a reliable way to deploy them to the always-on
server.

**Independent Test**: Run the deployment script, verify files are transferred, verify containers
are rebuilt and restarted, verify the health endpoint reports all services healthy.

**Acceptance Scenarios**:

1. **Given** updated source files on the dev laptop, **When** the deployment script is run,
   **Then** files are transferred to the server, containers are rebuilt, and services restart
   within five minutes.
2. **Given** a failed service in the previous deployment, **When** the deployment script runs a
   fresh deploy, **Then** the failed service is replaced with the updated version.
3. **Given** the deployment script completes, **When** the health endpoint is queried, **Then**
   all services report healthy.

---

### User Story 2 — Developer Seeds the Database with Demo Data for Testing (Priority: P1)

A developer runs the seed command. The database is populated with a realistic set of demo data:
sample operators, watchlist items, missions, agent runs, knowledge entries, and alerts. The
system is immediately usable for exploration and testing without manual data entry.

**Why this priority**: Demo data is needed for every team member and for manual testing of the
dashboard, the Telegram bot, and all agent outputs. Without seed data, every feature must be
individually bootstrapped before it can be demonstrated.

**Independent Test**: Run the seed command against an empty database, verify all expected entity
types are present in the database, run the seed command again and verify idempotency (no
duplicates).

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the seed command is run, **Then** all entity types are
   populated with at least one realistic example record.
2. **Given** an already-seeded database, **When** the seed command is run again, **Then** no
   duplicate records are created and existing records are not corrupted.
3. **Given** a seeded database, **When** the operator logs into the dashboard, **Then** the
   primary view immediately shows watchlist items, missions, and recent activity.

---

### User Story 3 — Cloud Infrastructure Is Defined as Code and Provisionable Reproducibly (Priority: P2)

A developer runs the infrastructure provisioning command. All required cloud resources (compute,
database, networking, secrets management) are created in the target cloud environment as defined.
Running the command again produces no changes if the infrastructure already matches the
definition. Tearing down and reprovisioning produces an identical environment.

**Why this priority**: Infrastructure-as-code ensures the production environment is reproducible
and version-controlled. Manual cloud console configurations are error-prone and undocumented.

**Independent Test**: Run the provision command against a clean cloud environment, verify the
expected resources are created, run it again and verify no changes, update a resource definition
and verify only the changed resource is updated.

**Acceptance Scenarios**:

1. **Given** a clean cloud environment, **When** the provision command is run, **Then** all
   required infrastructure resources are created as defined.
2. **Given** infrastructure already matching the definition, **When** the provision command is
   run, **Then** no resources are changed or recreated.
3. **Given** a change to one resource in the definition, **When** the provision command is run,
   **Then** only the changed resource is updated and others are unaffected.

---

### User Story 4 — Developer Views Live Logs for Any Service from the Dev Laptop (Priority: P2)

A developer runs a log-viewing script with a service name. The script SSHes into the server and
streams the live log output from that container. The developer can monitor behaviour in real time
without manually opening an SSH session and running container commands.

**Why this priority**: Log access is essential for debugging production issues. A convenient
helper script reduces friction for routine debugging tasks.

**Independent Test**: Start a container that produces log output, run the log-viewing script for
that container, verify log lines are streamed to the terminal on the dev laptop.

**Acceptance Scenarios**:

1. **Given** a running service on the Linux server, **When** the log script is called with the
   service name, **Then** live log output from that service is streamed to the developer's
   terminal.
2. **Given** an invalid service name, **When** the log script is called, **Then** an informative
   error is returned listing available service names.

---

### Edge Cases

- What happens if the deploy script runs while a migration is in progress on the server?
- How does seed data handle foreign-key constraints between entities?
- What if the cloud provider API is unavailable during infrastructure provisioning?
- What if the deploy script is interrupted halfway through (e.g., SSH connection drops)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A deployment script MUST transfer source files, rebuild containers, and restart all
  services on the Linux server with a single command from the dev laptop.
- **FR-002**: The deployment process MUST apply any pending database migrations automatically as
  part of deployment before the new service version starts accepting traffic.
- **FR-003**: A seed command MUST populate the database with realistic demo data for all entity
  types and MUST be idempotent (safe to run multiple times without creating duplicates).
- **FR-004**: Infrastructure MUST be defined as code in a versioned format and MUST be
  provisionable and reproducible from that definition alone.
- **FR-005**: Running the infrastructure provision command against an already-matching environment
  MUST produce no changes (idempotent).
- **FR-006**: A log-viewing script MUST allow the developer to stream live logs for any named
  service from the dev laptop via SSH.
- **FR-007**: All scripts MUST produce informative error messages when preconditions are not met
  (missing SSH key, unreachable server, invalid service name).
- **FR-008**: The container configuration MUST mount runtime YAML configuration files as
  read-only to prevent modification at runtime.
- **FR-009**: Secrets (API keys, database passwords) MUST be injected via environment variables
  at container start; they MUST NOT be baked into container images or committed to source control.

### Key Entities

- **DeploymentScript**: A shell script that automates the transfer, build, and restart steps for
  deploying to the Linux server.
- **SeedDataSet**: A defined set of realistic demo records covering all entity types, with valid
  relationships between them.
- **InfrastructureDefinition**: The version-controlled definition of all required cloud resources,
  managed as code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A full deployment from running the script to all services reporting healthy
  completes in under 5 minutes.
- **SC-002**: The seed command populates all entity types in under 30 seconds against the target
  database.
- **SC-003**: Running the seed command twice produces the same database state as running it once,
  with zero duplicates, verified by automated test.
- **SC-004**: The infrastructure provision command completes with no changes when run against an
  already-matching environment, verified by the provisioner's diff output.
- **SC-005**: All scripts exit with a non-zero code and a descriptive error message when any
  required precondition is not met.

## Assumptions

- The Linux server is accessible from the dev laptop via SSH with key-based authentication;
  the server address and user are configured in `.env`.
- The deployment script uses rsync to transfer files, minimising transfer time for incremental
  deploys.
- Seed data uses a fixed set of known-good demo records; it does not generate random data on
  each run (to ensure idempotency).
- The infrastructure-as-code tool supports the target cloud provider and manages compute,
  database, network, and secrets resources.
- Container images are built on the server (not on the dev laptop) to avoid cross-platform
  compilation issues.
