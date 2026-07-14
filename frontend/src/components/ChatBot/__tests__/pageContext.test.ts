let mockIsMultiCluster = false;

rstest.mock('config', () => ({
  get isMultiCluster() {
    return mockIsMultiCluster;
  }
}));

import { buildPageContext } from '../pageContext';

describe('buildPageContext', () => {
  it('does not append cluster in single-cluster environments', () => {
    mockIsMultiCluster = false;
    expect(buildPageContext('app', 'reviews', 'bookinfo', undefined, 'west')).toBe(
      'User is seeing the information about application reviews of namespace bookinfo'
    );
  });

  it('appends cluster in multi-cluster environments', () => {
    mockIsMultiCluster = true;
    expect(buildPageContext('app', 'reviews', 'bookinfo', undefined, 'west')).toBe(
      'User is seeing the information about application reviews of namespace bookinfo in cluster west'
    );
    mockIsMultiCluster = false;
  });

  it('appends health status on detail views', () => {
    mockIsMultiCluster = false;
    expect(buildPageContext('service', 'details', 'bookinfo', undefined, undefined, 'Failure')).toBe(
      'User is seeing the information about service details of namespace bookinfo with current health status Failure'
    );
  });
});
