import { describe, it, expect } from 'vitest';
import { categorize } from './categorize';

describe('categorize', () => {
  it('tags Fed policy stories', () => {
    const { categories } = categorize('Federal Reserve holds interest rates steady, Powell signals caution');
    expect(categories).toContain('Federal Reserve');
    expect(categories).toContain('Interest Rates');
  });

  it('tags CPI stories as Inflation', () => {
    const { categories } = categorize('CPI rises 0.3% in June, above forecasts');
    expect(categories).toContain('Inflation');
  });

  it('tags M&A stories and falls back to no sector', () => {
    const { categories, sector } = categorize('Acme Corp to acquire Widget Inc in $2B deal');
    expect(categories).toContain('Mergers & Acquisitions');
    expect(sector).toBeNull();
  });

  it('assigns a sector for tech stories', () => {
    const { categories, sector } = categorize('Semiconductor maker unveils new AI chip');
    expect(categories).toContain('Technology');
    expect(sector).toBe('Technology');
  });

  it('falls back to Market News when nothing else matches', () => {
    const { categories } = categorize('Company announces new office location');
    expect(categories).toEqual(['Market News']);
  });
});
