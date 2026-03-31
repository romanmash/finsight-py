export function buildPortfolioContextPrompt(quantity: number): string {
  return `Portfolio context: user holds quantity=${String(quantity)} for the instrument.`;
}
