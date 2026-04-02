#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const pulumiYaml = resolve("infra/pulumi/Pulumi.yaml");
if (!existsSync(pulumiYaml)) {
  console.error("[pulumi-preview] Missing infra/pulumi/Pulumi.yaml");
  process.exit(1);
}

const content = readFileSync(pulumiYaml, "utf8");
if (!content.includes("name:") || !content.includes("runtime:")) {
  console.error("[pulumi-preview] Pulumi.yaml missing required metadata fields.");
  process.exit(1);
}

console.log("[pulumi-preview] PASS: Pulumi baseline metadata present.");
