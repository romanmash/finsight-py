#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(".github/workflows/ci-cd.yml");
const content = readFileSync(workflowPath, "utf8");

const requiredTokens = [
  "pull_request:",
  "develop",
  "push:",
  "main",
  "runs-on: [self-hosted, linux]",
  "needs: build",
  "if: github.event_name == 'push' && github.ref == 'refs/heads/main'"
];

const missing = requiredTokens.filter((token) => !content.includes(token));
if (missing.length > 0) {
  console.error(`[ci-policy] Missing required workflow tokens: ${missing.join(" | ")}`);
  process.exit(1);
}

console.log("[ci-policy] PASS: required branch gating and runner policy tokens found.");
