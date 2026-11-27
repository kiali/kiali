import { getPagePath, isOSSMC } from '../NavigationUtils';

const locationState = { pathname: '/troubleshooting' };

rstest.mock('app/History', () => ({
  location: {
    getPathname: () => locationState.pathname,
    getSearch: () => ''
  },
  router: { navigate: rstest.fn() }
}));

describe('NavigationUtils OSSMC detection', () => {
  const originalPathname = window.location.pathname;

  beforeEach(() => {
    locationState.pathname = '/troubleshooting';
    window.history.replaceState({}, '', '/');
  });

  afterAll(() => {
    window.history.replaceState({}, '', originalPathname || '/');
  });

  it('is false for standalone Kiali paths', () => {
    locationState.pathname = '/troubleshooting';
    expect(isOSSMC()).toBe(false);
    expect(getPagePath()).toBe('troubleshooting');
  });

  it('is true for OSSMC plugin routes and strips the prefix from the page path', () => {
    locationState.pathname = '/ossmconsole/troubleshooting';
    expect(isOSSMC()).toBe(true);
    expect(getPagePath()).toBe('troubleshooting');
  });

  it('is true for OpenShift resource tabs that end with ossmconsole', () => {
    locationState.pathname = '/k8s/ns/bookinfo/deployments/details-v1/ossmconsole';
    expect(isOSSMC()).toBe(true);
  });

  it('is true when only the window location is an OSSMC path', () => {
    locationState.pathname = '/troubleshooting';
    window.history.replaceState({}, '', '/ossmconsole/overview');
    expect(isOSSMC()).toBe(true);
  });
});
