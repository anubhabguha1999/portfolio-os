import { describe, it, expect } from 'vitest';
import { diffSequence, diffSet, diffWords, lcsLength, sideText, similarity, tokenizeWords, wordStats } from '@/lib/diff';

describe('diffSequence', () => {
  it('finds the LCS and keeps element order', () => {
    const ops = diffSequence('ABCABBA'.split(''), 'CBABAC'.split(''));
    expect(ops.filter((o) => o.type === 'equal').length).toBe(4);
    expect(ops.filter((o) => o.type !== 'insert').map((o) => o.value).join('')).toBe('ABCABBA');
    expect(ops.filter((o) => o.type !== 'delete').map((o) => o.value).join('')).toBe('CBABAC');
  });

  it('handles empty inputs and identical inputs', () => {
    expect(diffSequence([], ['a'])).toEqual([{ type: 'insert', value: 'a' }]);
    expect(diffSequence(['a'], [])).toEqual([{ type: 'delete', value: 'a' }]);
    expect(diffSequence(['a', 'b'], ['a', 'b']).every((o) => o.type === 'equal')).toBe(true);
    expect(diffSequence([], [])).toEqual([]);
  });

  it('puts deletes before inserts inside a change', () => {
    const ops = diffSequence(['a', 'x', 'c'], ['a', 'y', 'c']);
    expect(ops.map((o) => o.type)).toEqual(['equal', 'delete', 'insert', 'equal']);
  });

  it('supports a custom equality', () => {
    expect(lcsLength(['A', 'b'], ['a', 'B'], (x, y) => x.toLowerCase() === y.toLowerCase())).toBe(2);
  });
});

describe('diffWords', () => {
  it('rebuilds both sides exactly', () => {
    const a = 'Cut median page load from 3.8s to 1.1s by moving rendering to the edge.';
    const b = 'Cut p95 page load from 3.8s to 0.9s by moving rendering to the CDN edge.';
    const ops = diffWords(a, b);
    expect(sideText(ops, 'a')).toBe(a);
    expect(sideText(ops, 'b')).toBe(b);
    expect(tokenizeWords(a).join('')).toBe(a);
  });

  it('marks only the changed words', () => {
    const ops = diffWords('Led a team of 5 engineers', 'Led a team of 8 engineers');
    expect(ops).toEqual([
      { type: 'equal', value: 'Led a team of ' },
      { type: 'delete', value: '5' },
      { type: 'insert', value: '8' },
      { type: 'equal', value: ' engineers' },
    ]);
    expect(wordStats(ops)).toEqual({ added: 1, removed: 1, same: 5 });
  });

  it('groups adjacent changed words into phrases', () => {
    const ops = diffWords('one two three four', 'one five six four');
    expect(ops).toEqual([
      { type: 'equal', value: 'one ' },
      { type: 'delete', value: 'two three' },
      { type: 'insert', value: 'five six' },
      { type: 'equal', value: ' four' },
    ]);
  });

  it('returns a single equal op for identical text and nothing for two empties', () => {
    expect(diffWords('same', 'same')).toEqual([{ type: 'equal', value: 'same' }]);
    expect(diffWords('', '')).toEqual([]);
    expect(diffWords('', 'new')).toEqual([{ type: 'insert', value: 'new' }]);
  });
});

describe('similarity and sets', () => {
  it('scores word overlap', () => {
    expect(similarity('a b c d', 'a b c d')).toBe(1);
    expect(similarity('a b c d', 'w x y z')).toBe(0);
    expect(similarity('a b c d', 'a b x d')).toBeCloseTo(0.75);
  });

  it('diffs sets case-insensitively and keeps spelling', () => {
    const d = diffSet(['React', 'Go', 'AWS'], ['react', 'Rust', 'AWS', 'Rust']);
    expect(d.added).toEqual(['Rust']);
    expect(d.removed).toEqual(['Go']);
    expect(d.common).toEqual(['react', 'AWS']);
  });
});
