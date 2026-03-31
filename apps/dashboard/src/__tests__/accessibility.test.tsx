import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SpendPanel } from '../dashboard/SpendPanel';

describe('accessibility baseline', () => {
  it('progress indicator exposes aria semantics', (): void => {
    const html = renderToStaticMarkup(<SpendPanel totalUsd={5} byProvider={{}} />);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow=');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });
});
