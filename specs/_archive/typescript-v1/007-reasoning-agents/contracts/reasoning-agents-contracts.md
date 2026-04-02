# Reasoning Agents Contracts (007)

## Purpose

Define the canonical input/output contracts and invariants for Analyst, Bookkeeper, Reporter, and Trader so implementation and orchestration remain consistent and testable.

## Upstream Contract Dependency (006)

- Consumer contracts must match published collector shapes from 006.
- `TechnicalCollectionOutput.confidence` is numeric `[0,1]`.
- Discovery evidence uses `supportingHeadline`.
- 007 must not rely on 006 internal execution details.

## Analyst Contract

### Input

```ts
interface RunAnalystInput {
  userId: string;
  missionId: string;
  mode: 'standard' | 'devil_advocate' | 'comparison';
  research: ResearchCollectionOutput | ResearchCollectionOutput[];
  portfolioContext?: {
    ticker: string;
    quantity: number;
    avgCost?: number;
  };
  existingThesis?: {
    content: string;
    updatedAt: string;
    confidence: 'low' | 'medium' | 'high';
  };
}
```

### Output

```ts
interface RunAnalystOutput {
  ticker: string | string[];
  mode: 'standard' | 'devil_advocate' | 'comparison';
  thesisUpdate: string;
  supportingEvidence: string[];
  riskFactors: string[];
  contradictions: string[];
  confidence: 'low' | 'medium' | 'high';
  confidenceReason: string;
  comparisonTable?: Record<string, unknown>;
}
```

### Invariants

- No direct tool calls during synthesis.
- Output must pass schema validation.
- One retry allowed on malformed model output.
- Comparison mode accepts exactly two instruments; other cardinalities are rejected.

## Bookkeeper Contract

### Input

```ts
interface RunBookkeeperInput {
  userId: string;
  missionId: string;
  analystOutput: RunAnalystOutput;
  missionType: string;
}
```

### Output

```ts
interface RunBookkeeperOutput {
  kbEntryId: string;
  changeType: 'initial' | 'update' | 'contradiction' | 'devil_advocate';
  contradictionSeverity: 'none' | 'low' | 'high';
  snapshotCreated: boolean;
}
```

### Invariants

- Prior thesis lookup is mandatory before write.
- Non-initial updates require pre-overwrite snapshot.
- Entry/snapshot/alert effects are transactional.
- High contradiction only triggers contradiction alert.
- KB persistence requires successful embedding generation.

## Reporter Contract

### Input

```ts
interface RunReporterInput {
  userId: string;
  missionId: string;
  missionType: string;
  payload: RunAnalystOutput | RunTraderOutput | Record<string, unknown>;
}
```

### Output

```ts
interface RunReporterOutput {
  delivered: boolean;
  messageCount: number;
  label: string;
  persistedDailyBriefId?: string;
}
```

### Invariants

- Must apply mission-aware labeling.
- Must use configured formatter fallback when primary unavailable.
- Must split oversized messages into valid chunks (`<= 4096` characters) while preserving order.
- Must persist daily brief record for `daily_brief`.
- Delivery failure after formatting is non-fatal to reasoning completion and is surfaced for orchestration-level retry handling.

## Trader Contract

### Input

```ts
interface RunTraderInput {
  userId: string;
  missionId: string;
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  analystOutput: RunAnalystOutput;
}
```

### Output

```ts
interface RunTraderOutput {
  ticketId: string;
  status: 'pending_approval';
  rationale: string;
  warningText: string;
}
```

### Invariants

- Rationale must be exactly three sentences.
- Every ticket must contain explicit human-approval warning text.
- Sell requests for non-held positions are rejected.
- Trade execution is out of scope; this contract only creates approval-pending proposals.
- Non-held position is determined by current portfolio quantity `<= 0` at ticket-creation time.
