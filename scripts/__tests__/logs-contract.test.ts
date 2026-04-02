import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("logs.sh contract", () => {
  it("requires target service and streams compose logs", () => {
    const script = readFileSync(resolve("scripts/logs.sh"), "utf8");

    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("missing required service argument");
    expect(script).toContain("docker compose logs -f");
  });
});
