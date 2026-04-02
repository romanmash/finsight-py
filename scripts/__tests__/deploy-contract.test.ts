import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("deploy.sh contract", () => {
  it("contains preflight, sync, restart, and healthcheck stages", () => {
    const script = readFileSync(resolve("scripts/deploy.sh"), "utf8");

    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("DEPLOY_HOST");
    expect(script).toContain("DEPLOY_USER");
    expect(script).toContain("rsync");
    expect(script).toContain("docker compose");
    expect(script).toContain("healthcheck");
  });
});
