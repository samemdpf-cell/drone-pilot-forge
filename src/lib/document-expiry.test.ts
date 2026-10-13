import { describe, it, expect } from 'vitest';
import { expiryStatus } from './document-expiry';
describe('Document expiry window', () => {
  it('includes exactly 30 days', () => expect(expiryStatus('2026-11-12', '2026-10-13')).toBe('soon'));
  it('does not include 31 days', () => expect(expiryStatus('2026-11-13', '2026-10-13')).toBe('valid'));
  it('includes expiry today', () => expect(expiryStatus('2026-10-13', '2026-10-13')).toBe('soon'));
  it('separates expired files', () => expect(expiryStatus('2026-10-12', '2026-10-13')).toBe('expired'));
  it('does not infer missing expiry', () => expect(expiryStatus(null, '2026-10-13')).toBe('unknown'));
});