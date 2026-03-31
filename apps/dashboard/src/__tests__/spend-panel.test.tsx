import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SpendPanel } from '../dashboard/SpendPanel';

describe('spend panel', () => {
  it('renders provider rows', () => {
    const html = renderToStaticMarkup(<SpendPanel totalUsd={3.2} byProvider={{ openai: 1 }} />);
    expect(html).toContain('anthropic');
    expect(html).toContain('openai');
    expect(html).toContain('lmstudio');
  });
});
