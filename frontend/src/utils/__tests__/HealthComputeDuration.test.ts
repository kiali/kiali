import { durationLabelToSeconds } from 'config/ServerConfig';

describe('durationLabelToSeconds', () => {
  it('maps known dropdown labels', () => {
    expect(durationLabelToSeconds('5m')).toBe(300);
    expect(durationLabelToSeconds('1m')).toBe(60);
    expect(durationLabelToSeconds('10m')).toBe(600);
    expect(durationLabelToSeconds('1h')).toBe(3600);
    expect(durationLabelToSeconds('30d')).toBe(2592000);
  });

  it('trims whitespace', () => {
    expect(durationLabelToSeconds('  5m  ')).toBe(300);
  });

  it('returns undefined for unknown labels', () => {
    expect(durationLabelToSeconds('')).toBeUndefined();
    expect(durationLabelToSeconds('1h30m')).toBeUndefined();
    expect(durationLabelToSeconds('90s')).toBeUndefined();
    expect(durationLabelToSeconds('7m')).toBeUndefined();
  });
});
