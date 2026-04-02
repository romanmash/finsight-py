#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(".env.example");
const content = readFileSync(envPath, "utf8");

const requiredKeys = [
  "DATABASE_URL",
  "REDIS_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "DEPLOY_HOST",
  "DEPLOY_USER",
  "PULUMI_STACK"
];

const missing = requiredKeys.filter((key) => !new RegExp(`^${key}=`, "m").test(content));
if (missing.length > 0) {
  console.error(`[env-contract] Missing required keys: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`[env-contract] PASS: ${requiredKeys.length} required keys present in .env.example.`);
