import { describe, it, expect } from 'vitest';
import { scoreImpact, scoreImportance, scoreSentiment, summarize } from './analysis';

describe('scoreSentiment', () => {
  it('classifies clearly positive text as Bullish', () => {
    const { label, confidence } = scoreSentiment('Company beats estimates, raises guidance, shares surge to record high');
    expect(label).toBe('Bullish');
    expect(confidence).toBeGreaterThan(50);
  });

  it('classifies clearly negative text as Bearish', () => {
    const { label } = scoreSentiment('Company misses estimates, cuts guidance amid lawsuit and layoffs');
    expect(label).toBe('Bearish');
  });

  it('classifies text with no signal as Neutral', () => {
    const { label } = scoreSentiment('Company to present at investor conference next week');
    expect(label).toBe('Neutral');
  });
});

describe('scoreImportance', () => {
  it('gives Federal Reserve stories a high base score', () => {
    const score = scoreImportance('Federal Reserve holds rates steady', ['Federal Reserve'], 70);
    expect(score).toBeGreaterThanOrEqual(8);
  });

  it('stays within 1-10', () => {
    const score = scoreImportance('a'.repeat(10), ['Consumer'], 50);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(10);
  });
});

describe('scoreImpact', () => {
  it('maps high importance + high confidence to High impact', () => {
    expect(scoreImpact(9, 90)).toBe('High');
  });
  it('maps low importance + neutral confidence to Low impact', () => {
    expect(scoreImpact(2, 50)).toBe('Low');
  });
});

describe('summarize', () => {
  it('falls back to the headline when there is no body', () => {
    expect(summarize('Headline only')).toBe('Headline only');
  });

  it('extracts the first sentences from a longer body', () => {
    const body =
      'This is the first sentence of the article. This is the second sentence with more detail. This is a third sentence that should be dropped.';
    const result = summarize('Headline', body);
    expect(result).toContain('first sentence');
    expect(result).toContain('second sentence');
    expect(result).not.toContain('third sentence');
  });
});
