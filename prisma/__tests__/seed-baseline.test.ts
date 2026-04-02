import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { runSeed } from "../seed";

const hasDb = Boolean(process.env.DATABASE_URL) && process.env.RUN_DB_TESTS === "true";
const describeDb = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();

describeDb("seed baseline presence", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("populates demo-critical domains", async () => {
    process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@finsight.local";
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "seed-test-password";

    const result = await runSeed(prisma);
    expect(result.status).toBe("success");

    const admin = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL } });
    expect(admin).not.toBeNull();

    const portfolioCount = await prisma.portfolioItem.count({ where: { userId: admin?.id } });
    const watchlistCount = await prisma.watchlistItem.count({ where: { userId: admin?.id } });
    const thesisCount = await prisma.kbEntry.count({ where: { ticker: "NVDA", entryType: "thesis_current" } });
    const historyCount = await prisma.kbThesisSnapshot.count({
      where: { ticker: "NVDA", changeSummary: { startsWith: "[seed:011]" } }
    });
    const screenerCount = await prisma.screenerRun.count({ where: { triggeredBy: "seed-011" } });
    const alertCount = await prisma.alert.count({ where: { message: { startsWith: "[seed:011]" } } });
    const missionCount = await prisma.mission.count({ where: { trigger: "seed-011" } });
    const agentRunCount = await prisma.agentRun.count({ where: { mission: { trigger: "seed-011" } } });
    const docCount = await prisma.kbEntry.count({ where: { entryType: "document_chunk", content: { startsWith: "[seed-doc]" } } });

    expect(portfolioCount).toBeGreaterThanOrEqual(3);
    expect(watchlistCount).toBeGreaterThanOrEqual(6);
    expect(thesisCount).toBeGreaterThanOrEqual(1);
    expect(historyCount).toBe(4);
    expect(screenerCount).toBe(1);
    expect(alertCount).toBe(1);
    expect(missionCount).toBe(2);
    expect(agentRunCount).toBe(2);
    expect(docCount).toBe(3);
  });
});

