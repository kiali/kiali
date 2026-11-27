import fs from 'fs';
import path from 'path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { PERF_ATTACHMENT, PERF_REPORT_FILE, formatReport, type PerfSample } from './utils/perfReport';

/**
 * Collects the samples attached by `measureLoadTime` and writes the text
 * report once the run ends. Reporting centrally keeps the file consistent
 * regardless of how tests are filtered, retried, or ordered.
 */
class PerfReporter implements Reporter {
  private readonly samples: PerfSample[] = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const attachment of result.attachments) {
      if (attachment.name === PERF_ATTACHMENT && attachment.body) {
        this.samples.push(JSON.parse(attachment.body.toString('utf8')) as PerfSample);
      }
    }
  }

  onEnd(): void {
    if (this.samples.length === 0) {
      return;
    }

    fs.mkdirSync(path.dirname(PERF_REPORT_FILE), { recursive: true });
    fs.writeFileSync(PERF_REPORT_FILE, formatReport(this.samples));

    console.log(`\nPerformance report: ${PERF_REPORT_FILE}`);
  }
}

export default PerfReporter;
