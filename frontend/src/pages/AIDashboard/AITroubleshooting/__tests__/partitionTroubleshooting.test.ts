import type { TroubleshootingIssue } from 'types/Chatbot';
import {
  hiddenProblemsTitle,
  partitionTroubleshootingIssues,
  summarizeTroubleshootingIssues,
  troubleshootingDetectedTitle
} from '../partitionTroubleshooting';

const issue = (id: string, subProblems: TroubleshootingIssue['subProblems']): TroubleshootingIssue => ({
  category: 'data_plane',
  id,
  problem: `Problem ${id}`,
  subProblems
});

describe('partitionTroubleshootingIssues', () => {
  it('keeps a parent with no subproblems in the visible list', () => {
    const parent = issue('parent', []);
    const partitioned = partitionTroubleshootingIssues([parent], ['missing']);

    expect(partitioned.visible).toEqual([parent]);
    expect(partitioned.hidden).toEqual([]);
  });

  it('duplicates a parent when only some subproblems are hidden', () => {
    const parent = issue('parent', [
      { id: 'visible', impact: 'ok', issue: 'shown', severity: 'warning', target: 'reviews-v1' },
      { id: 'hidden', impact: 'bad', issue: 'stored', severity: 'critical', target: 'reviews-v2' }
    ]);

    const partitioned = partitionTroubleshootingIssues([parent], ['hidden', 'stale-id']);

    expect(partitioned.visible).toEqual([{ ...parent, subProblems: [parent.subProblems[0]] }]);
    expect(partitioned.hidden).toEqual([{ ...parent, subProblems: [parent.subProblems[1]] }]);
    expect(parent.subProblems).toHaveLength(2);
  });

  it('moves a parent to the hidden list when every subproblem is hidden', () => {
    const parent = issue('parent', [{ id: 'hidden', impact: 'bad', issue: 'stored', target: 'reviews' }]);
    const partitioned = partitionTroubleshootingIssues([parent], ['hidden']);

    expect(partitioned.visible).toEqual([]);
    expect(partitioned.hidden).toHaveLength(1);
  });
});

describe('troubleshooting summary text', () => {
  it('counts visible problems and subproblem severities', () => {
    const summary = summarizeTroubleshootingIssues([
      issue('parent', [
        { id: 'a', impact: '', issue: '', severity: 'critical', target: 'a' },
        { id: 'b', impact: '', issue: '', severity: 'warning', target: 'b' },
        { id: 'c', impact: '', issue: '', severity: 'info', target: 'c' }
      ])
    ]);

    expect(summary).toEqual({ critical: 1, problems: 1, subproblems: 3, warning: 1 });
    // The test i18n stub keeps {{count}} and appends the options. Singular copy has no placeholder.
    const title = troubleshootingDetectedTitle(summary);
    expect(title).toContain('Troubleshooting: 1 problem detected');
    expect(title).toContain('{{count}} subproblems {"count":3}');
    expect(title).toContain('{{count}} critical {"count":1}');
    expect(title).toContain('{{count}} warning {"count":1}');
    expect(troubleshootingDetectedTitle({ critical: 0, problems: 2, subproblems: 1, warning: 0 })).toContain(
      '1 subproblem'
    );
    const hiddenTitle = hiddenProblemsTitle({ critical: 1, problems: 1, subproblems: 1, warning: 0 });
    expect(hiddenTitle).toContain('Hidden problems: 1 problem detected');
    expect(hiddenTitle).toContain('1 subproblem');
    expect(hiddenTitle).toContain('{{count}} critical {"count":1}');
  });
});
