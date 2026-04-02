import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ci-cd order", () => {
  it("enforces stage ordering and deploy branch gate", () => {
    const workflow = readFileSync(resolve(".github/workflows/ci-cd.yml"), "utf8");
    const typecheckPos = workflow.indexOf("typecheck:");
    const lintPos = workflow.indexOf("lint:");
    const testPos = workflow.indexOf("test:");
    const buildPos = workflow.indexOf("build:");
    const deployPos = workflow.indexOf("deploy:");

    expect(typecheckPos).toBeGreaterThan(-1);
    expect(lintPos).toBeGreaterThan(typecheckPos);
    expect(testPos).toBeGreaterThan(lintPos);
    expect(buildPos).toBeGreaterThan(testPos);
    expect(deployPos).toBeGreaterThan(buildPos);
    expect(workflow).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
  });
});
