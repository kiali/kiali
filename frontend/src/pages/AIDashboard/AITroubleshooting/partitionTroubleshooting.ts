import type { TroubleshootingIssue } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

export type PartitionedTroubleshootingIssues = {
  hidden: TroubleshootingIssue[];
  visible: TroubleshootingIssue[];
};

export type TroubleshootingListSummary = {
  critical: number;
  problems: number;
  subproblems: number;
  warning: number;
};

// A parent with both hidden and visible subproblems is copied into both lists.
// Parents with no subproblems stay in the visible list.
export const partitionTroubleshootingIssues = (
  issues: TroubleshootingIssue[],
  hiddenIds: readonly string[]
): PartitionedTroubleshootingIssues => {
  const hiddenSet = new Set(hiddenIds);
  const hidden: TroubleshootingIssue[] = [];
  const visible: TroubleshootingIssue[] = [];

  issues.forEach(issue => {
    const subProblems = issue.subProblems ?? [];
    if (subProblems.length === 0) {
      visible.push(issue);
      return;
    }

    const visibleSubs = subProblems.filter(subProblem => !hiddenSet.has(subProblem.id));
    const hiddenSubs = subProblems.filter(subProblem => hiddenSet.has(subProblem.id));
    if (visibleSubs.length > 0) {
      visible.push({ ...issue, subProblems: visibleSubs });
    }
    if (hiddenSubs.length > 0) {
      hidden.push({ ...issue, subProblems: hiddenSubs });
    }
  });

  return { hidden, visible };
};

export const summarizeTroubleshootingIssues = (issues: TroubleshootingIssue[]): TroubleshootingListSummary => {
  let critical = 0;
  let subproblems = 0;
  let warning = 0;

  issues.forEach(issue => {
    (issue.subProblems ?? []).forEach(subProblem => {
      subproblems += 1;
      if (subProblem.severity === 'critical') {
        critical += 1;
      } else if (subProblem.severity === 'warning') {
        warning += 1;
      }
    });
  });

  return { critical, problems: issues.length, subproblems, warning };
};

export const troubleshootingDetail = (summary: TroubleshootingListSummary): string => {
  const detected =
    summary.problems === 1 ? t('1 problem detected') : t('{{count}} problems detected', { count: summary.problems });
  const subproblems =
    summary.subproblems === 1 ? t('1 subproblem') : t('{{count}} subproblems', { count: summary.subproblems });

  return `${detected} (${subproblems}, ${t('{{count}} critical', { count: summary.critical })}, ${t('{{count}} warning', { count: summary.warning })})`;
};

export const troubleshootingDetectedTitle = (summary: TroubleshootingListSummary): string =>
  `${t('Troubleshooting')}: ${troubleshootingDetail(summary)}`;

export const hiddenProblemsTitle = (summary: TroubleshootingListSummary): string =>
  `${t('Hidden problems')}: ${troubleshootingDetail(summary)}`;
