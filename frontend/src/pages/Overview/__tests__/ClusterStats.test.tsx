import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Status } from 'types/IstioStatus';
import { Paths } from 'config';

import { ClusterStats } from '../ClusterStats';

jest.mock('hooks/clusters', () => ({
  useClusterStatus: jest.fn()
}));

jest.mock('hooks/redux', () => ({
  useKialiSelector: jest.fn()
}));

jest.mock('utils/MeshUtils', () => ({
  isControlPlaneAccessible: jest.fn()
}));

const useClusterStatusMock = require('hooks/clusters').useClusterStatus as jest.Mock;
const useKialiSelectorMock = require('hooks/redux').useKialiSelector as jest.Mock;
const isControlPlaneAccessibleMock = require('utils/MeshUtils').isControlPlaneAccessible as jest.Mock;

const renderComponent = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <ClusterStats />
    </MemoryRouter>
  );

describe('Overview ClusterStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useKialiSelectorMock.mockReturnValue('');
  });

  it('renders spinner while loading', () => {
    isControlPlaneAccessibleMock.mockReturnValue(true);
    useClusterStatusMock.mockReturnValue({
      isLoading: true,
      statusMap: { c1: [{ cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy }] }
    });

    renderComponent();

    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('shows total/healthy/unhealthy counters and builds mesh links for clusters with issues', async () => {
    const user = userEvent.setup();
    isControlPlaneAccessibleMock.mockReturnValue(true);
    useClusterStatusMock.mockReturnValue({
      isLoading: false,
      statusMap: {
        c1: [
          { cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy },
          { cluster: 'c1', isCore: true, name: 'kiali', status: Status.Healthy }
        ],
        c2: [
          { cluster: 'c2', isCore: true, name: 'istiod', status: Status.Unhealthy },
          { cluster: 'c2', isCore: true, name: 'kiali', status: Status.Healthy }
        ],
        c3: [{ cluster: 'c3', isCore: true, name: 'istiod', status: Status.Unreachable }],
        c4: [{ cluster: 'c4', isCore: true, name: 'istiod', status: Status.NotFound }]
      }
    });

    renderComponent();

    expect(screen.getByTestId('clusters-card-title').textContent).toContain('Clusters (4)');

    const issuesTrigger = screen.getByTestId('clusters-issues');

    expect(document.body.textContent).toContain('1');

    expect(issuesTrigger.textContent).toContain('3');

    await user.click(issuesTrigger);

    const linkC2 = await screen.findByRole('link', { name: 'c2' });
    const allLinks = screen.getAllByRole('link');
    expect(allLinks.some(a => a.getAttribute('href')?.includes(`/${Paths.MESH}?meshHide=`))).toBeTruthy();
    expect(allLinks.some(a => decodeURIComponent(a.getAttribute('href') ?? '').includes('cluster!=c2'))).toBeTruthy();
    expect(allLinks.some(a => decodeURIComponent(a.getAttribute('href') ?? '').includes('cluster!=c3'))).toBeTruthy();
    expect(allLinks.some(a => decodeURIComponent(a.getAttribute('href') ?? '').includes('cluster!=c4'))).toBeTruthy();
    expect(linkC2).toBeInTheDocument();

    expect(screen.getByText('Unknown status')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /view mesh/i }).getAttribute('href')).toBe(`/${Paths.MESH}`);
  });

  it('uses unknown icon when issues are only unknown', async () => {
    const user = userEvent.setup();
    isControlPlaneAccessibleMock.mockReturnValue(true);
    useClusterStatusMock.mockReturnValue({
      isLoading: false,
      statusMap: {
        c1: [{ cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy }],
        c2: [{ cluster: 'c2', isCore: true, name: 'istiod', status: Status.NotFound }]
      }
    });

    renderComponent();

    expect(screen.getByTestId('clusters-issues').textContent).toContain('1');

    await user.click(screen.getByTestId('clusters-issues'));

    expect(await screen.findByText('Unknown status')).toBeInTheDocument();
  });

  it('hides mesh links when control plane is not accessible', async () => {
    const user = userEvent.setup();
    isControlPlaneAccessibleMock.mockReturnValue(false);
    useClusterStatusMock.mockReturnValue({
      isLoading: false,
      statusMap: {
        c1: [{ cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy }],
        c2: [{ cluster: 'c2', isCore: true, name: 'istiod', status: Status.Unhealthy }]
      }
    });

    renderComponent();

    expect(screen.queryByRole('link', { name: /view mesh/i })).not.toBeInTheDocument();

    await user.click(screen.getByTestId('clusters-issues'));
    await screen.findByText('c2');
    expect(screen.queryByRole('link', { name: 'c2' })).not.toBeInTheDocument();
  });
});
