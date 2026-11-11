import type { TroubleshootingIssue } from 'types/Chatbot';
import {
  cleanSubProblemIssueText,
  filterAndGroupTroubleshootingIssues,
  hiddenProblemsTitle,
  isRedundantSubProblemImpact,
  parseTroubleshootingTarget,
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

  it('hides a parent and every subproblem when the parent id is hidden', () => {
    const parent = issue('parent', [
      { id: 'visible', impact: 'ok', issue: 'shown', severity: 'warning', target: 'reviews-v1' },
      { id: 'kept', impact: 'bad', issue: 'stored', severity: 'critical', target: 'reviews-v2' }
    ]);

    const partitioned = partitionTroubleshootingIssues([parent], ['parent']);

    expect(partitioned.visible).toEqual([]);
    expect(partitioned.hidden).toEqual([parent]);
  });

  it('hides a parent that has no subproblems', () => {
    const parent = issue('parent', []);
    const partitioned = partitionTroubleshootingIssues([parent], ['parent']);

    expect(partitioned.visible).toEqual([]);
    expect(partitioned.hidden).toEqual([parent]);
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

  it('parses target badges, namespaces, and cleans redundant issue/impact text', () => {
    const drSub = {
      checks: [{ code: 'KIA0203', message: 'No matching host', severity: 'critical' }],
      id: 'istio-bookinfo-destinationrule-reviews',
      impact: 'DestinationRule "reviews" in namespace "bookinfo" fails validation.',
      issue: 'DestinationRule "reviews" fails validation',
      istioObject: {
        group: 'networking.istio.io',
        kind: 'DestinationRule',
        name: 'reviews',
        namespace: 'bookinfo',
        version: 'v1'
      },
      severity: 'critical',
      target: 'DestinationRule: bookinfo/reviews'
    };

    const parsed = parseTroubleshootingTarget(drSub);
    expect(parsed).toEqual({
      badgeKey: 'DestinationRule',
      kind: 'DestinationRule',
      name: 'reviews',
      namespace: 'bookinfo'
    });
    expect(cleanSubProblemIssueText(drSub, parsed)).toBe('fails validation');
    expect(isRedundantSubProblemImpact(drSub)).toBe(true);

    const wlSub = {
      id: 'dp-wl',
      impact: 'Workload (Deployment) "reviews-v2" in namespace "bookinfo" is not healthy. (mesh mode: Sidecar)',
      issue: 'health is DEGRADED',
      severity: 'warning',
      target: 'Workload (Deployment): bookinfo/reviews-v2'
    };
    const parsedWl = parseTroubleshootingTarget(wlSub);
    expect(parsedWl).toEqual({
      badgeKey: 'Workload',
      kind: 'Workload (Deployment)',
      name: 'reviews-v2',
      namespace: 'bookinfo'
    });
    expect(isRedundantSubProblemImpact(wlSub)).toBe(false);

    const shaSub = {
      id: 'mesh-ver',
      impact: 'Full SHA in impact',
      issue:
        'proxy version a7556f3c898f59f6bff392afb1debc5081f59044b679e80957ed3b24d26e0eaa differs from control plane 1.31.1',
      severity: 'warning',
      target: 'Workload (Deployment): bookinfo/details-v1'
    };
    expect(cleanSubProblemIssueText(shaSub, parseTroubleshootingTarget(shaSub))).toBe(
      'proxy version a7556f3c... differs from control plane 1.31.1'
    );
  });

  it('filters by severity and search query and groups by namespace or severity', () => {
    const issues: TroubleshootingIssue[] = [
      {
        category: 'data_plane',
        id: 'dp-bookinfo',
        problem: 'Namespace bookinfo is DEGRADED',
        subProblems: [
          {
            id: 'sp-crit',
            impact: 'Crash',
            issue: 'pod status is CrashLoopBackOff',
            severity: 'critical',
            target: 'Pod: bookinfo/reviews-v2-pod'
          },
          {
            id: 'sp-warn',
            impact: 'Missing sidecar',
            issue: 'missing Istio sidecar',
            severity: 'warning',
            target: 'Workload (Deployment): alpha/details-v1'
          }
        ]
      }
    ];

    const criticalOnly = filterAndGroupTroubleshootingIssues(issues, {
      groupBy: 'category',
      search: '',
      severityFilter: 'critical'
    });
    expect(criticalOnly).toHaveLength(1);
    expect(criticalOnly[0].subProblems).toHaveLength(1);
    expect(criticalOnly[0].subProblems[0].id).toBe('sp-crit');

    const bySearch = filterAndGroupTroubleshootingIssues(issues, {
      groupBy: 'category',
      search: 'alpha',
      severityFilter: 'all'
    });
    expect(bySearch[0].subProblems).toHaveLength(1);
    expect(bySearch[0].subProblems[0].id).toBe('sp-warn');

    const byNamespace = filterAndGroupTroubleshootingIssues(issues, {
      groupBy: 'namespace',
      search: '',
      severityFilter: 'all'
    });
    expect(byNamespace.map(g => g.problem)).toEqual(['Namespace: alpha', 'Namespace: bookinfo']);

    const bySeverity = filterAndGroupTroubleshootingIssues(issues, {
      groupBy: 'severity',
      search: '',
      severityFilter: 'all'
    });
    expect(bySeverity.map(g => g.problem)).toEqual(['Critical issues', 'Warning issues']);
  });
});
