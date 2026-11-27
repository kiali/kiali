/**
 * Report format shared by the measurement helpers (which attach samples) and
 * the perf reporter (which renders them). Kept free of `@playwright/test`
 * imports so the reporter can load it without pulling in test-runner globals.
 */

/** Attachment name carrying one measured page load. */
export const PERF_ATTACHMENT = 'kiali-perf-sample';

/** Text report collecting every measurement of a run. */
export const PERF_REPORT_FILE = process.env.PERF_REPORT_FILE ?? 'playwright/results/performance.txt';

const PRECISION = 5;

export type PerfSample = {
  /** Expected load time in seconds. */
  baseline: number;
  /** Measured average load time in seconds. */
  durationSec: number;
  /** Measured page, e.g. `All Namespaces Apps`. */
  name: string;
  /** Report section the measurement belongs to, e.g. `Apps List page`. */
  section: string;
};

const signedDifference = (durationSec: number, baseline: number): string => {
  const difference = durationSec - baseline;

  if (difference > 0) {
    return `+${difference.toPrecision(PRECISION)}`;
  } else if (difference < 0) {
    return `-${Math.abs(difference).toPrecision(PRECISION)}`;
  }

  return '0';
};

/** One report line: measured average, its baseline, and the signed delta. */
export const formatSample = ({ baseline, durationSec, name }: PerfSample): string =>
  `${name} load time: ${durationSec.toPrecision(PRECISION)} sec, baseline: ${baseline} sec, difference: ${signedDifference(durationSec, baseline)} sec`;

/** Render the whole report, sections in the order they were measured. */
export const formatReport = (samples: PerfSample[]): string => {
  const sections = new Map<string, PerfSample[]>();

  for (const sample of samples) {
    const existing = sections.get(sample.section);
    if (existing) {
      existing.push(sample);
    } else {
      sections.set(sample.section, [sample]);
    }
  }

  const blocks = [...sections].map(
    ([section, sectionSamples]) => `[${section}]\n\n${sectionSamples.map(formatSample).join('\n')}\n`
  );

  return blocks.join('\n');
};
