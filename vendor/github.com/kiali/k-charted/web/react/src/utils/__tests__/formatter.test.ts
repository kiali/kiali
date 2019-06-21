import { getFormatter } from '../formatter';

describe('Formatter', () => {
  it('should format seconds', () => {
    const res = getFormatter('seconds')(10);
    expect(res).toBe('10 s');
  });

  it('should format bytes', () => {
    const res = getFormatter('bytes')(4096);
    expect(res).toBe('4.096 kB');
  });

  it('should format bytes IEC', () => {
    const res = getFormatter('bytes-iec')(4096);
    expect(res).toBe('4 KiB');
  });

  it('should not downscale bytes', () => {
    const res = getFormatter('bytes')(0.5);
    expect(res).toBe('0.5 B');
  });

  it('should format custom', () => {
    const res = getFormatter('m')(4000);
    expect(res).toBe('4 km');
  });

  it('should format bps', () => {
    const res = getFormatter('bitrate')(4194304);
    expect(res).toBe('4.1943 Mbit/s');
  });

  it('should format bps IEC', () => {
    const res = getFormatter('bitrate-iec')(4194304);
    expect(res).toBe('4 Mibit/s');
  });
});
