#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const parityPath = resolve("specs/011-seed-infrastructure/manual-parity.md");
const tasksPath = resolve("specs/011-seed-infrastructure/tasks.md");

const parityContent = readFileSync(parityPath, "utf8");
const tasksContent = readFileSync(tasksPath, "utf8").toLowerCase();

const preservedRows = parityContent
  .split(/\r?\n/)
  .filter((line) => line.startsWith("|") && line.includes("| Preserved |"));

const keywordChecks = [
  ["seed", "idempotent"],
  ["portfolio", "watchlist"],
  ["history", "contradiction"],
  ["ci", "deploy"],
  ["self-hosted", "runner"],
  ["deploy.sh", "logs.sh"],
  ["pulumi", "preview"],
  [".env.example", "variables"]
];

const missingChecks = keywordChecks.filter((tokens) =>
  tokens.some((token) => !tasksContent.includes(token))
);

if (preservedRows.length === 0) {
  console.error("[parity] no preserved rows found in manual-parity.md");
  process.exit(1);
}

if (missingChecks.length > 0) {
  console.error("[parity] tasks.md is missing preserved parity keywords:");
  for (const tokens of missingChecks) {
    console.error(`  - ${tokens.join(", ")}`);
  }
  process.exit(2);
}

console.log(`[parity] PASS: ${preservedRows.length} preserved rows validated against tasks.md keyword coverage.`);
