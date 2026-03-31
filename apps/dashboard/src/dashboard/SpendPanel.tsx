import { formatPercent, formatUsd } from './formatters';

interface SpendPanelProps {
  totalUsd: number;
  byProvider: Record<string, number>;
  dailyBudgetUsd?: number;
}

const PROVIDER_BASELINE = ['anthropic', 'openai', 'azure', 'lmstudio'];
const FALLBACK_DAILY_BUDGET_USD = 25;
const ENV_DAILY_BUDGET_USD = Number(import.meta.env.VITE_DAILY_BUDGET_USD ?? String(FALLBACK_DAILY_BUDGET_USD));
const DEFAULT_DAILY_BUDGET_USD =
  Number.isFinite(ENV_DAILY_BUDGET_USD) && ENV_DAILY_BUDGET_USD > 0 ? ENV_DAILY_BUDGET_USD : FALLBACK_DAILY_BUDGET_USD;

function orderedProviders(byProvider: Record<string, number>): string[] {
  const extras = Object.keys(byProvider).filter((provider) => !PROVIDER_BASELINE.includes(provider)).sort();
  return [...PROVIDER_BASELINE, ...extras];
}

export function SpendPanel({ totalUsd, byProvider, dailyBudgetUsd = DEFAULT_DAILY_BUDGET_USD }: SpendPanelProps): JSX.Element {
  const budget = Number.isFinite(dailyBudgetUsd) && dailyBudgetUsd > 0 ? dailyBudgetUsd : DEFAULT_DAILY_BUDGET_USD;
  const budgetPercent = (totalUsd / budget) * 100;

  return (
    <section className="panel">
      <h2>Spend</h2>
      <p className="spend-total">{formatUsd(totalUsd)}</p>
      <div className="budget-track" role="progressbar" aria-valuenow={budgetPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="budget-fill" style={{ width: `${Math.min(100, Math.max(0, budgetPercent))}%` }} />
      </div>
      <p>{formatPercent(budgetPercent)} of budget</p>
      <ul className="provider-list">
        {orderedProviders(byProvider).map((provider) => (
          <li key={provider}>
            <span>{provider}</span>
            <strong>{formatUsd(byProvider[provider] ?? 0)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
