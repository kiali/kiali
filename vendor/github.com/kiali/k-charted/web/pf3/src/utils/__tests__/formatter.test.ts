import { format } from 'd3-format';
import { getFormatter } from '../../../../common/utils/formatter';

describe('Formatter', () => {
  it('should format seconds', () => {
    const res = getFormatter(format, 'seconds')(10);
    expect(res).toBe('10 s');
  });

  it('should format bytes', () => {
    const res = getFormatter(format, 'bytes')(4096);
    expect(res).toBe('4.096 kB');
  });

  it('should format bytes IEC', () => {
    const res = getFormatter(format, 'bytes-iec')(4096);
    expect(res).toBe('4 KiB');
  });

  it('should not downscale bytes', () => {
    const res = getFormatter(format, 'bytes')(0.5);
    expect(res).toBe('0.5 B');
  });

  it('should format custom', () => {
    const res = getFormatter(format, 'm')(4000);
    expect(res).toBe('4 km');
  });

  it('should format bps', () => {
    const res = getFormatter(format, 'bitrate')(4194304);
    expect(res).toBe('4.1943 Mbit/s');
  });

  it('should format bps IEC', () => {
    const res = getFormatter(format, 'bitrate-iec')(4194304);
    expect(res).toBe('4 Mibit/s');
  });
});
