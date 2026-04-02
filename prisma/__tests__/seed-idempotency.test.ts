import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { runSeed } from "../seed";

const hasDb = Boolean(process.env.DATABASE_URL) && process.env.RUN_DB_TESTS === "true";
const describeDb = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();

describeDb("seed idempotency", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs twice without duplicate logical records", async () => {
    process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@finsight.local";
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "seed-test-password";
    process.env.ANALYST_EMAIL = process.env.ANALYST_EMAIL ?? "analyst@finsight.local";
    process.env.ANALYST_PASSWORD = process.env.ANALYST_PASSWORD ?? "seed-test-password";

    const first = await runSeed(prisma);
    const second = await runSeed(prisma);

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");

    const adminCount = await prisma.user.count({ where: { email: process.env.ADMIN_EMAIL } });
    const analystCount = await prisma.user.count({ where: { email: process.env.ANALYST_EMAIL } });

    expect(adminCount).toBe(1);
    expect(analystCount).toBe(1);

    const alertCount = await prisma.alert.count({
      where: {
        message: { startsWith: "[seed:011]" }
      }
    });
    expect(alertCount).toBe(1);
  });
});

