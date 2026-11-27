import type { Span } from 'types/Tracing';

import { t } from 'utils/I18nUtils';

import type { TimeInSeconds } from '../../types/Common';
import type { LogEntry } from '../../types/IstioObjects';

export type WorkloadPodLogEntry = {
  logEntry?: LogEntry;
  span?: Span;
  timestamp: string;
  timestampUnix: TimeInSeconds;
};

export function getLogFilterRegexError(value: string, useRegex: boolean, label: 'Hide' | 'Show'): string | undefined {
  if (!value || !useRegex) {
    return undefined;
  }

  try {
    RegExp(value);
    return undefined;
  } catch (e) {
    if (e instanceof Error) {
      return label === 'Show'
        ? t('Show: {{message}}', { message: e.message })
        : t('Hide: {{message}}', { message: e.message });
    }

    return t('Invalid regular expression');
  }
}

/**
 * Pure log-line filter for the pod logs view. Regex syntax errors are validated on Enter / regex toggle
 * via getLogFilterRegexError; invalid patterns are skipped here so filtering stays safe during render.
 */
export function filterLogEntries(
  entries: WorkloadPodLogEntry[],
  showValue: string,
  hideValue: string,
  useRegex: boolean
): WorkloadPodLogEntry[] {
  let filteredEntries = entries;

  if (showValue) {
    if (useRegex) {
      try {
        const regexp = RegExp(showValue);
        filteredEntries = filteredEntries.filter(e => !e.logEntry || regexp.test(e.logEntry.message));
      } catch {
        // Pattern failed at runtime; validation UI should have blocked bad input on submit.
      }
    } else {
      filteredEntries = filteredEntries.filter(e => !e.logEntry || e.logEntry.message.includes(showValue));
    }
  }

  if (hideValue) {
    if (useRegex) {
      try {
        const regexp = RegExp(hideValue);
        filteredEntries = filteredEntries.filter(e => !e.logEntry || !regexp.test(e.logEntry.message));
      } catch {
        // Pattern failed at runtime; validation UI should have blocked bad input on submit.
      }
    } else {
      filteredEntries = filteredEntries.filter(e => !e.logEntry || !e.logEntry.message.includes(hideValue));
    }
  }

  return filteredEntries;
}
