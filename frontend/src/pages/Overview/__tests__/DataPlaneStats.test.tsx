import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const useKialiSelectorMock = require('hooks/redux').useKialiSelector as jest.Mock;

type TestNamespaceHealth = {
  appHealth: Record<string, any>;
  serviceHealth: Record<string, any>;
  workloadHealth: Record<string, any>;
  worstStatus: string;
};

const makeNamespaceHealth = (status: any): TestNamespaceHealth => ({
  appHealth: {
    item: {
      getStatus: () => status
    }
  },
  serviceHealth: {},
  workloadHealth: {},
  worstStatus: status?.id ?? 'NA'
});

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

const flushAllPromises = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await flushPromises();
  }
};

const renderAndFlush = async (): Promise<void> => {
  await act(async () => {
    render(
      <MemoryRouter>
        <DataPlaneStats />
      </MemoryRouter>
    );
  });
  await act(async () => {
    await flushAllPromises();
  });
};

describe('Overview DataPlaneStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useKialiSelectorMock.mockReturnValue('');
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

    await renderAndFlush();

    expect(NamespaceHealthService.fetchClusterNamespacesHealth).toHaveBeenCalledTimes(1);
    expect(NamespaceHealthService.fetchClusterNamespacesHealth).toHaveBeenCalledWith(['amb', 'sc1', 'sc2'], undefined);

    expect(screen.getByText(/data planes \(3\)/i)).toBeInTheDocument();
  });

  it('renders separate counters per status bucket and navigates with data-plane type filter', async () => {
    useNamespacesMock.mockReturnValue({
      isLoading: false,
      namespaces: [
        { name: 'f1', labels: { 'istio-injection': 'enabled' } },
        { name: 'f2', labels: { 'istio-injection': 'enabled' } },
        { name: 'd1', isAmbient: true },
        { name: 'nr1', labels: { 'istio.io/rev': 'rev1' } },
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

    await renderAndFlush();

    expect(screen.getByTestId('data-planes-unhealthy').textContent).toContain('4');
    expect(screen.getByTestId('data-planes-na').textContent).toContain('1');

    const viewLink = screen.getByTestId('data-planes-view');
    const url = viewLink.getAttribute('href') ?? '';
    expect(url.startsWith(`/${Paths.NAMESPACES}?`)).toBeTruthy();
    expect(url).toMatch(/[?&]type=Data(\+|%20)plane/);
  });

  it('shows unhealthy popover footer link when unhealthy > 3 and navigates with 3 health filters', async () => {
    const user = userEvent.setup();
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

    await renderAndFlush();

    await user.click(screen.getByTestId('data-planes-unhealthy'));

    const linkBtn = await screen.findByTestId('data-planes-view-unhealthy');
    const url = linkBtn.getAttribute('href') ?? '';
    expect(url.startsWith(`/${Paths.NAMESPACES}?`)).toBeTruthy();
    expect(url).toMatch(/[?&]type=Data(\+|%20)plane/);
    expect(url).toMatch(/[?&]health=Failure/);
    expect(url).toMatch(/[?&]health=Degraded/);
    expect(url).toMatch(/[?&]health=Not(\+|%20)Ready/);
  });
});
