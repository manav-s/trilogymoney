import { describe, it, expect } from 'vitest';

import { splitIntoSmsSegments } from '../lib/integrations/sms';

describe('splitIntoSmsSegments', () => {
  it('splits sentences and trims whitespace', () => {
    const input = 'cash is 2000. cards owed 1500!   another line? extra   spaces';
    const segments = splitIntoSmsSegments(input);
    expect(segments).toEqual([
      'cash is 2000.',
      'cards owed 1500!',
      'another line?',
      'extra   spaces',
    ]);
  });

  it('caps the number of segments when limit provided and filters empties', () => {
    const input = 'a. b. c. d. e. f. g.';
    const segments = splitIntoSmsSegments(input, 5);
    expect(segments.length).toBe(5);
    expect(segments[0]).toBe('a.');
  });

  it('falls back to empty array when nothing useful', () => {
    const segments = splitIntoSmsSegments('   ');
    expect(segments).toEqual([]);
  });
});

