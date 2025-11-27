import { describe, it, expect } from 'vitest';
import { sanitizeOutput as sanitizeLlmOutput } from '../lib/ai/llm';
import { sanitizeOutput as sanitizeConvoOutput } from '../lib/ai/conversationWithTools';

const cases = [
  { input: 'a-b', expected: 'a-b', label: 'preserves hyphen' },
  { input: 'a–b', expected: 'a,b', label: 'replaces en dash with comma' },
  { input: 'a—b', expected: 'a,b', label: 'replaces em dash with comma' },
  { input: 'mix-–—hyphens', expected: 'mix-,,hyphens', label: 'handles mixed dashes' },
];

describe('sanitizeOutput', () => {
  for (const { input, expected, label } of cases) {
    it(`llm: ${label}`, () => {
      expect(sanitizeLlmOutput(input)).toBe(expected);
    });
    it(`conversation: ${label}`, () => {
      expect(sanitizeConvoOutput(input)).toBe(expected);
    });
  }
});
