import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

type SeedCounts = Record<string, number>;

type SeedRunSummary = {
  status: "success" | "failed";
  created: SeedCounts;
  updated: SeedCounts;
  warnings: string[];
  errorMessage?: string;
};

type SeedContext = {
  prisma: PrismaClient;
  created: SeedCounts;
  updated: SeedCounts;
  warnings: string[];
};

type SeedUser = {
  email: string;
  password: string;
  name: string;
  role: string;
  telegramHandle: string | null;
};

type SeedMission = {
  type: string;
  status: string;
  tickers: string[];
  outputData: Record<string, unknown>;
  createdAt: Date;
  completedAt: Date;
};

const SEED_TAG = "seed-011";
const DEMO_TICKER = "NVDA";
const DEFAULT_BCRYPT_ROUNDS = 10;

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required seed environment variable: ${name}`);
  }
  return value;
}

function parseBcryptRounds(): number {
  const raw = process.env.BCRYPT_ROUNDS;
  if (!raw) {
    return DEFAULT_BCRYPT_ROUNDS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 8 || parsed > 15) {
    throw new Error("BCRYPT_ROUNDS must be an integer between 8 and 15");
  }

  return parsed;
}

function increment(counter: SeedCounts, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

async function ensureSchemaReady(client: PrismaClient): Promise<void> {
  const rows = await client.$queryRaw<Array<{ regclass: string | null }>>`
    SELECT to_regclass('public."User"') as regclass
  `;

  if (!rows[0]?.regclass) {
    throw new Error("Database schema is not ready. Run migrations before seed.");
  }
}

async function upsertUser(context: SeedContext, payload: SeedUser, rounds: number): Promise<string> {
  const existing = await context.prisma.user.findUnique({ where: { email: payload.email } });
  const passwordHash = await bcrypt.hash(payload.password, rounds);

  if (existing) {
    await context.prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        name: payload.name,
        role: payload.role,
        telegramHandle: payload.telegramHandle,
        active: true,
        createdBy: SEED_TAG
      }
    });
    increment(context.updated, "users");
    return existing.id;
  }

  const created = await context.prisma.user.create({
    data: {
      email: payload.email,
      passwordHash,
      name: payload.name,
      role: payload.role,
      telegramHandle: payload.telegramHandle,
      active: true,
      createdBy: SEED_TAG
    }
  });
  increment(context.created, "users");
  return created.id;
}

async function seedPortfolioAndWatchlists(context: SeedContext, userId: string): Promise<void> {
  const holdings = [
    { ticker: "NVDA", quantity: 50 },
    { ticker: "AAPL", quantity: 100 },
    { ticker: "GLD", quantity: 20 }
  ];

  for (const holding of holdings) {
    const existing = await context.prisma.portfolioItem.findUnique({
      where: { userId_ticker: { userId, ticker: holding.ticker } }
    });

    if (existing) {
      await context.prisma.portfolioItem.update({
        where: { id: existing.id },
        data: { quantity: holding.quantity }
      });
      increment(context.updated, "portfolioItems");
    } else {
      await context.prisma.portfolioItem.create({
        data: { userId, ticker: holding.ticker, quantity: holding.quantity }
      });
      increment(context.created, "portfolioItems");
    }
  }

  const watchlists = [
    { listType: "portfolio", ticker: "NVDA", name: "NVIDIA", sector: "Semiconductors" },
    { listType: "portfolio", ticker: "AAPL", name: "Apple", sector: "Technology" },
    { listType: "portfolio", ticker: "GLD", name: "SPDR Gold Shares", sector: "Commodities" },
    { listType: "interesting", ticker: "SPY", name: "SPDR S&P 500", sector: "Index ETF" },
    { listType: "interesting", ticker: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
    { listType: "interesting", ticker: "MSFT", name: "Microsoft", sector: "Technology" }
  ];

  for (const item of watchlists) {
    const existing = await context.prisma.watchlistItem.findUnique({
      where: {
        userId_ticker_listType: {
          userId,
          ticker: item.ticker,
          listType: item.listType
        }
      }
    });

    if (existing) {
      await context.prisma.watchlistItem.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          sector: item.sector,
          active: true
        }
      });
      increment(context.updated, "watchlistItems");
    } else {
      await context.prisma.watchlistItem.create({
        data: {
          userId,
          ticker: item.ticker,
          name: item.name,
          sector: item.sector,
          listType: item.listType,
          active: true
        }
      });
      increment(context.created, "watchlistItems");
    }
  }
}

async function seedKnowledge(context: SeedContext): Promise<void> {
  const embeddingConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (!embeddingConfigured) {
    context.warnings.push("OPENAI_API_KEY not set; seed will skip vector embedding generation for KB baseline entries.");
  }

  const thesisContent = "[seed:011] NVDA thesis: AI datacenter demand remains strong with margin resilience.";
  const currentThesis = await context.prisma.kbEntry.findFirst({
    where: {
      ticker: DEMO_TICKER,
      entryType: "thesis_current"
    },
    orderBy: { createdAt: "desc" }
  });

  if (currentThesis) {
    await context.prisma.kbEntry.update({
      where: { id: currentThesis.id },
      data: {
        content: thesisContent,
        metadata: { seedTag: SEED_TAG, version: "v1", embeddingConfigured },
        contradictionFlag: false,
        contradictionNote: null
      }
    });
    increment(context.updated, "kbEntries");
  } else {
    await context.prisma.kbEntry.create({
      data: {
        ticker: DEMO_TICKER,
        entryType: "thesis_current",
        content: thesisContent,
        metadata: { seedTag: SEED_TAG, version: "v1", embeddingConfigured }
      }
    });
    increment(context.created, "kbEntries");
  }

  await context.prisma.kbThesisSnapshot.deleteMany({
    where: {
      ticker: DEMO_TICKER,
      changeSummary: { startsWith: "[seed:011]" }
    }
  });

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const history = [
    { daysAgo: 10, confidence: "medium", changeType: "new", thesis: "Supply-demand balance stable.", summary: "[seed:011] Baseline cautious stance." },
    { daysAgo: 7, confidence: "medium", changeType: "update", thesis: "Channel checks indicate stronger demand.", summary: "[seed:011] Transition to neutral-positive." },
    { daysAgo: 4, confidence: "low", changeType: "contradiction", thesis: "Short-term margin pressure risk emerging.", summary: "[seed:011] Contradiction event recorded." },
    { daysAgo: 1, confidence: "high", changeType: "update", thesis: "AI capex cycle supports renewed bullish stance.", summary: "[seed:011] Bullish recovery thesis." }
  ];

  for (const snapshot of history) {
    await context.prisma.kbThesisSnapshot.create({
      data: {
        ticker: DEMO_TICKER,
        thesis: snapshot.thesis,
        confidence: snapshot.confidence,
        changeType: snapshot.changeType,
        changeSummary: snapshot.summary,
        createdAt: new Date(now - snapshot.daysAgo * dayMs)
      }
    });
    increment(context.created, "kbThesisSnapshots");
  }

  await context.prisma.kbEntry.deleteMany({
    where: {
      entryType: "document_chunk",
      content: { startsWith: "[seed-doc]" }
    }
  });

  const documents = [
    "[seed-doc] NVDA earnings call: management raises datacenter guidance.",
    "[seed-doc] Semiconductor demand outlook: enterprise inference workloads accelerating.",
    "[seed-doc] Market brief: portfolio hedging discussion for AI-heavy allocations."
  ];

  for (const content of documents) {
    await context.prisma.kbEntry.create({
      data: {
        ticker: DEMO_TICKER,
        entryType: "document_chunk",
        content,
        metadata: { seedTag: SEED_TAG, source: "seeded-demo" }
      }
    });
    increment(context.created, "ingestedDocuments");
  }
}

async function seedScreenerAndAlerts(context: SeedContext, userId: string): Promise<void> {
  await context.prisma.screenerRun.deleteMany({ where: { triggeredBy: SEED_TAG } });
  await context.prisma.screenerRun.create({
    data: {
      triggeredBy: SEED_TAG,
      results: {
        findings: [
          { ticker: "AMD", reason: "Semiconductor momentum breakout" },
          { ticker: "MSFT", reason: "Cloud AI demand acceleration" },
          { ticker: "NVDA", reason: "Positive revisions trend" }
        ]
      }
    }
  });
  increment(context.created, "screenerRuns");

  await context.prisma.alert.deleteMany({
    where: {
      userId,
      message: { startsWith: "[seed:011]" }
    }
  });

  await context.prisma.alert.create({
    data: {
      userId,
      ticker: DEMO_TICKER,
      alertType: "earnings_approaching",
      severity: "high",
      acknowledged: false,
      message: "[seed:011] NVDA earnings in 2 days; review thesis assumptions."
    }
  });
  increment(context.created, "alerts");
}

async function seedMissions(context: SeedContext, userId: string): Promise<void> {
  await context.prisma.agentRun.deleteMany({ where: { mission: { trigger: SEED_TAG } } });
  await context.prisma.mission.deleteMany({ where: { trigger: SEED_TAG } });

  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const missions: SeedMission[] = [
    {
      type: "daily_brief",
      status: "completed",
      tickers: ["NVDA", "AAPL", "GLD"],
      outputData: { summary: "Seeded daily brief completed." },
      createdAt: new Date(now - 30 * hourMs),
      completedAt: new Date(now - 29 * hourMs)
    },
    {
      type: "pattern_request",
      status: "completed",
      tickers: ["NVDA", "AMD", "MSFT"],
      outputData: { summary: "Seeded pattern request completed." },
      createdAt: new Date(now - 12 * hourMs),
      completedAt: new Date(now - 11 * hourMs)
    }
  ];

  for (const item of missions) {
    const mission = await context.prisma.mission.create({
      data: {
        userId,
        type: item.type,
        status: item.status,
        trigger: SEED_TAG,
        inputData: { seedTag: SEED_TAG, tickers: item.tickers },
        outputData: item.outputData,
        tickers: item.tickers,
        createdAt: item.createdAt,
        completedAt: item.completedAt
      }
    });
    increment(context.created, "missions");

    await context.prisma.agentRun.create({
      data: {
        missionId: mission.id,
        agentName: item.type === "daily_brief" ? "reporter" : "analyst",
        model: "local-default",
        provider: "lmstudio",
        inputData: { seedTag: SEED_TAG },
        outputData: { result: "ok" },
        toolCalls: [],
        confidence: "medium",
        confidenceReason: "Seeded trace",
        durationMs: 900,
        tokensIn: 600,
        tokensOut: 420,
        costUsd: 0,
        status: "completed"
      }
    });
    increment(context.created, "agentRuns");
  }
}

export async function runSeed(client: PrismaClient = prisma): Promise<SeedRunSummary> {
  const adminEmail = requiredEnv("ADMIN_EMAIL");
  const adminPassword = requiredEnv("ADMIN_PASSWORD");
  const analystEmail = process.env.ANALYST_EMAIL ?? "analyst@finsight.local";
  const analystPassword = process.env.ANALYST_PASSWORD ?? adminPassword;
  const rounds = parseBcryptRounds();

  await ensureSchemaReady(client);

  const context: SeedContext = {
    prisma: client,
    created: {},
    updated: {},
    warnings: []
  };

  const adminId = await upsertUser(
    context,
    {
      email: adminEmail,
      password: adminPassword,
      name: "Admin",
      role: "admin",
      telegramHandle: "finsight_admin"
    },
    rounds
  );

  await upsertUser(
    context,
    {
      email: analystEmail,
      password: analystPassword,
      name: "Analyst",
      role: "analyst",
      telegramHandle: "finsight_analyst"
    },
    rounds
  );

  await seedPortfolioAndWatchlists(context, adminId);
  await seedKnowledge(context);
  await seedScreenerAndAlerts(context, adminId);
  await seedMissions(context, adminId);

  return {
    status: "success",
    created: context.created,
    updated: context.updated,
    warnings: context.warnings
  };
}

async function main(): Promise<void> {
  try {
    const summary = await runSeed(prisma);
    console.log(JSON.stringify(summary));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown seed failure";
    const failed: SeedRunSummary = {
      status: "failed",
      created: {},
      updated: {},
      warnings: [],
      errorMessage: message
    };

    console.error(JSON.stringify(failed));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.VITEST !== "true") {
  void main();
}


