import * as React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { ReactWrapper } from 'enzyme';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { DataPlaneStats } from '../DataPlaneStats';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY } from 'types/Health';
import { Paths } from 'config';
import * as NamespaceHealthService from 'services/NamespaceHealth';

jest.mock('hooks/namespaces', () => ({
  useNamespaces: jest.fn()
}));

jest.mock('hooks/redux', () => ({
  useKialiSelector: jest.fn()
}));

jest.mock('react-redux', () => {
  const actual = (jest as any).requireActual('react-redux');
  return {
    ...actual,
    useSelector: jest.fn()
  };
});

jest.mock('services/NamespaceHealth', () => ({
  fetchClusterNamespacesHealth: jest.fn()
}));

jest.mock('utils/AlertUtils', () => ({
  addDanger: jest.fn()
}));

jest.mock('services/Api', () => ({
  getErrorString: jest.fn(() => 'err')
}));

jest.mock('app/History', () => ({
  router: { navigate: jest.fn() }
}));

const useNamespacesMock = require('hooks/namespaces').useNamespaces as jest.Mock;
const useSelectorMock = require('react-redux').useSelector as jest.Mock;
const useKialiSelectorMock = require('hooks/redux').useKialiSelector as jest.Mock;

type TestNamespaceHealth = {
  appHealth: Record<string, any>;
  serviceHealth: Record<string, any>;
  workloadHealth: Record<string, any>;
};

const makeNamespaceHealth = (status: any): TestNamespaceHealth => ({
  appHealth: {
    item: {
      getStatus: () => status
    }
  },
  serviceHealth: {},
  workloadHealth: {}
});

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

const flushAllPromises = async (): Promise<void> => {
  // NamespaceStats triggers a couple of async state updates (fetch + finally).
  // Flushing several ticks avoids "not wrapped in act" warnings.
  for (let i = 0; i < 5; i++) {
    await flushPromises();
  }
};

const mountAndFlush = async (): Promise<ReactWrapper> => {
  let wrapper!: ReactWrapper;
  await act(async () => {
    wrapper = mount(
      <MemoryRouter>
        <DataPlaneStats />
      </MemoryRouter>
    );
  });
  await act(async () => {
    await flushAllPromises();
  });
  wrapper.update();
  return wrapper;
};

describe('Overview DataPlaneStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSelectorMock.mockReturnValue(60);
    useKialiSelectorMock.mockReturnValue(''); // Non-kiosk mode
  });

  it('fetches health only for data-plane namespaces and sets total to ambient+sidecar', async () => {
    useNamespacesMock.mockReturnValue({
      isLoading: false,
      namespaces: [
        { name: 'cp', isControlPlane: true },
        { name: 'out', labels: {} },
        { name: 'amb', isAmbient: true },
        { name: 'sc1', labels: { 'istio-injection': 'enabled' } },
        { name: 'sc2', labels: { 'istio.io/rev': 'canary' } }
      ]
    });

    (NamespaceHealthService.fetchClusterNamespacesHealth as jest.Mock).mockResolvedValue(
      new Map<string, any>([
        ['amb', makeNamespaceHealth(FAILURE)],
        ['sc1', makeNamespaceHealth(DEGRADED)],
        ['sc2', makeNamespaceHealth(HEALTHY)]
      ])
    );

    const wrapper = await mountAndFlush();

    expect(NamespaceHealthService.fetchClusterNamespacesHealth).toHaveBeenCalledTimes(1);
    // Only 'amb', 'sc1', 'sc2' should be requested (no control-plane, no out-of-mesh)
    expect(NamespaceHealthService.fetchClusterNamespacesHealth).toHaveBeenCalledWith(
      ['amb', 'sc1', 'sc2'],
      60,
      undefined
    );

    expect(wrapper.text()).toContain('Data planes (3)');
  });

  it('renders separate counters per status bucket and navigates with data-plane type filter', async () => {
    useNamespacesMock.mockReturnValue({
      isLoading: false,
      namespaces: [
        { name: 'f1', labels: { 'istio-injection': 'enabled' } },
        { name: 'f2', labels: { 'istio-injection': 'enabled' } },
        { name: 'd1', isAmbient: true },
        { name: 'nr1', labels: { 'istio.io/rev': 'rev1' } },
        // 'na1' will be NA because health response omits it
        { name: 'na1', isAmbient: true }
      ]
    });

    (NamespaceHealthService.fetchClusterNamespacesHealth as jest.Mock).mockResolvedValue(
      new Map<string, any>([
        ['f1', makeNamespaceHealth(FAILURE)],
        ['f2', makeNamespaceHealth(FAILURE)],
        ['d1', makeNamespaceHealth(DEGRADED)],
        ['nr1', makeNamespaceHealth(NOT_READY)]
      ])
    );

    const wrapper = await mountAndFlush();

    expect(wrapper.find('[data-test="data-planes-unhealthy"]').text()).toContain('4');
    expect(wrapper.find('[data-test="data-planes-na"]').text()).toContain('1');

    const viewLink = wrapper.find('[data-test="data-planes-view"]').first();
    expect(viewLink.exists()).toBeTruthy();

    // Verify link href is correctly built (use 'to' prop from Link component if 'href' not available)
    const url = (viewLink.prop('href') as string) ?? (viewLink.prop('to') as string);
    expect(url.startsWith(`/${Paths.NAMESPACES}?`)).toBeTruthy();
    // Data plane filter should be present; URLSearchParams encodes spaces as '+'
    expect(url).toMatch(/[?&]type=Data(\+|%20)plane/);
  });

  it('shows unhealthy popover footer link when unhealthy > 3 and navigates with 3 health filters', async () => {
    useNamespacesMock.mockReturnValue({
      isLoading: false,
      namespaces: [
        { name: 'f1', labels: { 'istio-injection': 'enabled' } },
        { name: 'f2', labels: { 'istio-injection': 'enabled' } },
        { name: 'd1', isAmbient: true },
        { name: 'nr1', labels: { 'istio.io/rev': 'rev1' } }
      ]
    });

    (NamespaceHealthService.fetchClusterNamespacesHealth as jest.Mock).mockResolvedValue(
      new Map<string, any>([
        ['f1', makeNamespaceHealth(FAILURE)],
        ['f2', makeNamespaceHealth(FAILURE)],
        ['d1', makeNamespaceHealth(DEGRADED)],
        ['nr1', makeNamespaceHealth(NOT_READY)]
      ])
    );

    const wrapper = await mountAndFlush();

    const popover = wrapper.find('Popover[aria-label="Unhealthy Data planes"]').first();
    expect(popover.exists()).toBeTruthy();

    const bodyContent = popover.prop('bodyContent') as any;
    const popoverBody = mount(<MemoryRouter>{bodyContent}</MemoryRouter>);

    const linkBtn = popoverBody.find('[data-test="data-planes-view-unhealthy"]').first();
    expect(linkBtn.exists()).toBeTruthy();

    // Verify link href is correctly built with all health filters (use 'to' prop from Link component if 'href' not available)
    const url = (linkBtn.prop('href') as string) ?? (linkBtn.prop('to') as string);
    expect(url.startsWith(`/${Paths.NAMESPACES}?`)).toBeTruthy();
    expect(url).toMatch(/[?&]type=Data(\+|%20)plane/);
    expect(url).toMatch(/[?&]health=Failure/);
    expect(url).toMatch(/[?&]health=Degraded/);
    expect(url).toMatch(/[?&]health=Not(\+|%20)Ready/);
  });
});
