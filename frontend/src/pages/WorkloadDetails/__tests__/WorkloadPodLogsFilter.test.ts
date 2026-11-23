import type { WorkloadPodLogEntry } from '../WorkloadPodLogsFilter';
import { filterLogEntries, getLogFilterRegexError } from '../WorkloadPodLogsFilter';

const logLine = (message: string): WorkloadPodLogEntry => ({
  logEntry: { message } as WorkloadPodLogEntry['logEntry'],
  timestamp: '',
  timestampUnix: 0
});

const spanLine = (): WorkloadPodLogEntry => ({
  span: {} as WorkloadPodLogEntry['span'],
  timestamp: '1',
  timestampUnix: 1
});

describe('WorkloadPodLogsFilter', () => {
  describe('filterLogEntries', () => {
    const entries: WorkloadPodLogEntry[] = [logLine('GET /foo'), logLine('POST /bar'), spanLine()];

    it('returns all entries when show and hide are empty', () => {
      expect(filterLogEntries(entries, '', '', false)).toHaveLength(3);
    });

    it('filters by show substring', () => {
      const filtered = filterLogEntries(entries, 'GET', '', false);
      expect(filtered).toHaveLength(2);
      expect(filtered.some(e => e.logEntry?.message === 'GET /foo')).toBe(true);
      expect(filtered.some(e => e.span)).toBe(true);
    });

    it('filters by hide substring', () => {
      const filtered = filterLogEntries(entries, '', 'POST', false);
      expect(filtered).toHaveLength(2);
      expect(filtered.some(e => e.logEntry?.message === 'GET /foo')).toBe(true);
    });

    it('filters by show regex', () => {
      const filtered = filterLogEntries(entries, '^GET', '', true);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].logEntry?.message).toBe('GET /foo');
    });

    it('skips invalid show regex without throwing', () => {
      expect(filterLogEntries(entries, '[', '', true)).toHaveLength(3);
    });

    it('keeps span rows when show filter matches a log line', () => {
      const filtered = filterLogEntries(entries, 'POST', '', false);
      expect(filtered).toHaveLength(2);
      expect(filtered.some(e => e.span)).toBe(true);
      expect(filtered.some(e => e.logEntry?.message === 'POST /bar')).toBe(true);
    });
  });

  describe('getLogFilterRegexError', () => {
    it('returns undefined when regex mode is off', () => {
      expect(getLogFilterRegexError('[', false, 'Show')).toBeUndefined();
    });

    it('returns undefined for a valid pattern', () => {
      expect(getLogFilterRegexError('^GET', true, 'Show')).toBeUndefined();
    });

    it('returns a message for an invalid pattern', () => {
      const error = getLogFilterRegexError('[', true, 'Show');
      expect(error).toBeDefined();
      expect(error).toContain('Show');
    });
  });
});
