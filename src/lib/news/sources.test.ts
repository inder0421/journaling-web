import { describe, it, expect } from 'vitest';
import { mergeBySource, type SourceResult } from './sources';
import type { RawNewsItem } from './types';

function item(id: string): RawNewsItem {
  return { id, headline: id, source: 'Finnhub', time: new Date().toISOString() };
}

describe('mergeBySource', () => {
  it('combines multiple results for the same source into one row', () => {
    const results: SourceResult[] = [
      { source: 'Finnhub', configured: true, ok: true, items: [item('a')] },
      { source: 'Finnhub', configured: true, ok: true, items: [item('b')] },
    ];
    const merged = mergeBySource(results);
    expect(merged).toHaveLength(1);
    expect(merged[0].items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('surfaces a failure even if a sibling call for the same source succeeded', () => {
    const results: SourceResult[] = [
      { source: 'SEC EDGAR', configured: true, ok: true, items: [item('a')] },
      { source: 'SEC EDGAR', configured: true, ok: false, items: [], error: 'boom' },
    ];
    const merged = mergeBySource(results);
    expect(merged).toHaveLength(1);
    expect(merged[0].ok).toBe(false);
    expect(merged[0].error).toBe('boom');
  });

  it('leaves distinct sources as separate rows', () => {
    const results: SourceResult[] = [
      { source: 'Finnhub', configured: true, ok: true, items: [] },
      { source: 'Yahoo Finance', configured: false, ok: true, items: [] },
    ];
    expect(mergeBySource(results)).toHaveLength(2);
  });
});
