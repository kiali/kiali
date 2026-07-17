let mockIsMultiCluster = true;

rstest.mock('config', () => ({
  get isMultiCluster() {
    return mockIsMultiCluster;
  }
}));

import { buildPageContext } from '../pageContext';

describe('buildPageContext', () => {
  beforeEach(() => {
    mockIsMultiCluster = true;
  });

  it('returns undefined when kind is not provided', () => {
    expect(buildPageContext(undefined, undefined, undefined, undefined)).toBeUndefined();
  });

  describe('list views', () => {
    it('returns mesh graph context', () => {
      expect(buildPageContext('mesh', undefined, undefined, undefined)).toBe('User is seeing the mesh Graph');
    });

    it('returns traffic graph context', () => {
      expect(buildPageContext('graph', undefined, undefined, undefined)).toBe('User is seeing the Traffic Graph');
    });

    it.each(['workloads', 'services', 'applications', 'namespaces'])('returns list context for %s', kind => {
      expect(buildPageContext(kind, undefined, undefined, undefined)).toBe(`User is seeing the List of ${kind}`);
    });

    it('returns istio objects list context', () => {
      expect(buildPageContext('istio', undefined, undefined, undefined)).toBe('User is seeing the istio objects list');
    });

    it('returns generic page context for unknown kind', () => {
      expect(buildPageContext('overview', undefined, undefined, undefined)).toBe('User is seeing the overview page');
    });

    it('appends namespace to list view', () => {
      expect(buildPageContext('workloads', undefined, 'bookinfo', undefined)).toBe(
        'User is seeing the List of workloads for namespaces: bookinfo'
      );
    });
  });

  describe('detail views', () => {
    it('returns istio object detail context', () => {
      expect(buildPageContext('istio', 'my-vs', 'bookinfo', 'virtualservices')).toBe(
        'User is seeing the istio object my-vs of namespace bookinfo that is type virtualservices'
      );
    });

    it('defaults istio type to unknown when not provided', () => {
      expect(buildPageContext('istio', 'my-vs', 'bookinfo', undefined)).toBe(
        'User is seeing the istio object my-vs of namespace bookinfo that is type unknown'
      );
    });

    it.each([
      ['app', 'application'],
      ['applications', 'application'],
      ['wk', 'workload'],
      ['workloads', 'workload'],
      ['srv', 'service'],
      ['services', 'service']
    ])('maps kind %s to %s in detail view', (kind, expected) => {
      expect(buildPageContext(kind, 'reviews', 'bookinfo', undefined)).toBe(
        `User is seeing the information about ${expected} reviews of namespace bookinfo`
      );
    });

    it('does not append namespace for namespace kind', () => {
      expect(buildPageContext('namespace', 'bookinfo', 'bookinfo', undefined)).toBe(
        'User is seeing the information about namespace bookinfo'
      );
    });

    it('appends health status on detail views', () => {
      expect(buildPageContext('service', 'details', 'bookinfo', undefined, undefined, 'Failure')).toBe(
        'User is seeing the information about service details of namespace bookinfo with current health status Failure'
      );
    });
  });

  describe('cluster context', () => {
    it('appends cluster to list view in multi-cluster environments', () => {
      expect(buildPageContext('workloads', undefined, 'bookinfo', undefined, 'east')).toBe(
        'User is seeing the List of workloads for namespaces: bookinfo in cluster east'
      );
    });

    it('appends cluster to detail view in multi-cluster environments', () => {
      expect(buildPageContext('app', 'reviews', 'bookinfo', undefined, 'west')).toBe(
        'User is seeing the information about application reviews of namespace bookinfo in cluster west'
      );
    });

    it('does not append cluster in single-cluster environments', () => {
      mockIsMultiCluster = false;
      expect(buildPageContext('app', 'reviews', 'bookinfo', undefined, 'west')).toBe(
        'User is seeing the information about application reviews of namespace bookinfo'
      );
    });

    it('does not append cluster when undefined', () => {
      const result = buildPageContext('workloads', undefined, undefined, undefined, undefined);
      expect(result).not.toContain('in cluster');
    });

    it('does not append cluster when empty string', () => {
      const result = buildPageContext('workloads', undefined, undefined, undefined, '');
      expect(result).not.toContain('in cluster');
    });
  });
});
