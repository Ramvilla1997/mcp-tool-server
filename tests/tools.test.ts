import { describe, expect, it } from 'vitest';
import { computeTextStats } from '../src/tools/textStats.js';
import { extractJsonPath } from '../src/tools/jsonExtract.js';

describe('computeTextStats', () => {
  it('counts words, sentences, characters, and reading time', () => {
    expect(computeTextStats('One two three. Four five!')).toEqual({
      words: 5,
      sentences: 2,
      characters: 25,
      readingMinutes: 0,
    });
  });

  it('returns zeros for empty text', () => {
    expect(computeTextStats('')).toEqual({ words: 0, sentences: 0, characters: 0, readingMinutes: 0 });
  });
});

describe('extractJsonPath', () => {
  const document = JSON.stringify({ orders: [{ id: 1, total: 398 }], meta: { currency: 'USD' } });

  it('reads nested values by path', () => {
    expect(extractJsonPath(document, 'orders[0].total')).toBe(398);
    expect(extractJsonPath(document, 'meta.currency')).toBe('USD');
  });

  it('rejects paths outside the grammar, without evaluating them', () => {
    expect(() => extractJsonPath(document, 'orders.constructor()')).toThrow(/path must look like/);
    expect(() => extractJsonPath(document, '__proto__.polluted')).toThrow(/no property "__proto__"/);
  });

  it('reports missing properties and indexes', () => {
    expect(() => extractJsonPath(document, 'orders[5].total')).toThrow(/no item at index 5/);
    expect(() => extractJsonPath(document, 'meta.region')).toThrow(/no property "region"/);
  });

  it('reports invalid JSON', () => {
    expect(() => extractJsonPath('{', 'a')).toThrow(/not valid JSON/);
  });
});
