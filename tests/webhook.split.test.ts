import { describe, it, expect } from 'vitest';

import { splitIntoSmsSegments } from '../lib/integrations/sms';

describe('splitIntoSmsSegments', () => {
  it('splits on double newlines (blank lines) to separate logical sections', () => {
    const input = `here are your subscriptions:
- netflix $15
- spotify $10

total: $25/month

that's a lot of streaming`;
    const segments = splitIntoSmsSegments(input);
    expect(segments).toEqual([
      'here are your subscriptions:\n- netflix $15\n- spotify $10',
      'total: $25/month',
      "that's a lot of streaming",
    ]);
  });

  it('keeps single newlines together (bullet lists stay as one message)', () => {
    const input = '- item 1\n- item 2\n- item 3';
    const segments = splitIntoSmsSegments(input);
    expect(segments).toEqual(['- item 1\n- item 2\n- item 3']);
  });

  it('caps the number of segments when limit provided', () => {
    const input = 'a\n\nb\n\nc\n\nd\n\ne\n\nf\n\ng';
    const segments = splitIntoSmsSegments(input, 3);
    expect(segments.length).toBe(3);
    expect(segments).toEqual(['a', 'b', 'c']);
  });

  it('falls back to empty array when nothing useful', () => {
    const segments = splitIntoSmsSegments('   ');
    expect(segments).toEqual([]);
  });

  it('trims whitespace from each section', () => {
    const input = '  first section  \n\n  second section  ';
    const segments = splitIntoSmsSegments(input);
    expect(segments).toEqual(['first section', 'second section']);
  });
});

