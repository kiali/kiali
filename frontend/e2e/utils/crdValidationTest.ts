import type { TestInfo } from '@playwright/test';

/** Unique kubectl object name per test so CRD validation specs can run in parallel. */
export function crdResourceName(testInfo: TestInfo, base: string): string {
  const kia = testInfo.title.match(/\bKIA\d+\b/)?.[0]?.toLowerCase();
  if (kia) {
    const variant = testInfo.title.toLowerCase().includes('wildcard') ? '-wildcard' : '';
    return `${base}-${kia}${variant}`;
  }
  if (testInfo.title.includes('grouped')) {
    return `${base}-grouped`;
  }
  if (testInfo.title.includes('references to Gateway')) {
    return `${base}-gwref`;
  }
  return `${base}-${testInfo.testId.replace(/-/g, '').slice(0, 8)}`;
}
