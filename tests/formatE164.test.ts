import { describe, it, expect } from 'vitest';
import { formatE164 } from '../lib/integrations/blooio';

describe('formatE164', () => {
  // Already valid E.164 - passthrough
  it('passes through valid E.164 US number', () => {
    expect(formatE164('+15551234567')).toBe('+15551234567');
  });

  it('passes through valid E.164 UK number', () => {
    expect(formatE164('+447700900123')).toBe('+447700900123');
  });

  // E.164 with formatting - strip it
  it('strips formatting from E.164 number with spaces', () => {
    expect(formatE164('+1 555 123 4567')).toBe('+15551234567');
  });

  it('strips formatting from E.164 number with dashes', () => {
    expect(formatE164('+44-7700-900-123')).toBe('+447700900123');
  });

  // US/Canada formats (only country we assume)
  it('formats 10-digit US number', () => {
    expect(formatE164('5551234567')).toBe('+15551234567');
  });

  it('formats 11-digit US number with leading 1', () => {
    expect(formatE164('15551234567')).toBe('+15551234567');
  });

  it('formats US number with dashes', () => {
    expect(formatE164('555-123-4567')).toBe('+15551234567');
  });

  it('formats US number with parentheses', () => {
    expect(formatE164('(555) 123-4567')).toBe('+15551234567');
  });

  // Edge cases
  it('handles leading/trailing whitespace', () => {
    expect(formatE164('  +15551234567  ')).toBe('+15551234567');
  });

  // Errors - require + for international
  it('throws on UK number without + prefix', () => {
    expect(() => formatE164('447700900123')).toThrow('must include country code');
  });

  it('throws on UK local format without +', () => {
    expect(() => formatE164('07700900123')).toThrow('must include country code');
  });

  it('throws on too-short number', () => {
    expect(() => formatE164('12345')).toThrow('Invalid phone number format');
  });

  it('throws on empty string', () => {
    expect(() => formatE164('')).toThrow('Invalid phone number format');
  });
});
