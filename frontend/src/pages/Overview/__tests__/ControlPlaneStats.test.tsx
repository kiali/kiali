import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Status } from 'types/IstioStatus';
import { Paths } from 'config';

import { ControlPlaneStats } from '../ControlPlaneStats';

jest.mock('hooks/controlPlanes', () => ({
  useControlPlanes: jest.fn()
}));

jest.mock('components/Badge/IstioAPIDisabledBadge', () => ({
  IstioAPIDisabledBadge: () => null
}));

jest.mock('hooks/redux', () => ({
  useKialiSelector: jest.fn()
}));

jest.mock('components/Filters/StatefulFilters', () => ({
  FilterSelected: { resetFilters: jest.fn() }
}));

jest.mock('app/History', () => ({
  router: { navigate: jest.fn() },
  URLParam: {
    MESH_HIDE: 'meshHide'
  }
}));

const useControlPlanesMock = require('hooks/controlPlanes').useControlPlanes as jest.Mock;
const useKialiSelectorMock = require('hooks/redux').useKialiSelector as jest.Mock;
const resetFiltersMock = require('components/Filters/StatefulFilters').FilterSelected.resetFilters as jest.Mock;

describe('Overview ControlPlaneStats', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useKialiSelectorMock.mockReturnValue('');
  });

  const renderComponent = (): void => {
    render(
      <MemoryRouter>
        <ControlPlaneStats />
      </MemoryRouter>
    );
  };

  it('renders loading state', () => {
    useControlPlanesMock.mockReturnValue({
      controlPlanes: [],
      isError: false,
      isLoading: true,
      refresh
    });

    renderComponent();
    expect(screen.getByText(/control planes/i)).toBeInTheDocument();
    expect(screen.getByText(/fetching control plane data/i)).toBeInTheDocument();
  });

  it('renders error state and retries on try again', async () => {
    const user = userEvent.setup();
    useControlPlanesMock.mockReturnValue({
      controlPlanes: [],
      isError: true,
      isLoading: false,
      refresh
    });

    renderComponent();
    expect(screen.getByText(/control planes could not be loaded/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders stats and navigates to namespaces on view button click', async () => {
    const user = userEvent.setup();
    useControlPlanesMock.mockReturnValue({
      controlPlanes: [
        {
          cluster: { name: 'c1' },
          istiodName: 'istiod-1',
          status: Status.Healthy
        },
        {
          cluster: { name: 'c2' },
          istiodName: 'istiod-2',
          status: Status.Unhealthy
        }
      ],
      isError: false,
      isLoading: false,
      refresh
    });

    renderComponent();

    expect(screen.getByText(/control planes \(2\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('control-planes-issues').textContent).toContain('1');

    const viewLink = screen.getByTestId('control-planes-view-namespaces');
    const url = viewLink.getAttribute('href') ?? '';
    expect(url.startsWith(`/${Paths.NAMESPACES}?`)).toBeTruthy();
    expect(url).toMatch(/[?&]type=Control(\+|%20)plane/);

    await user.click(viewLink);
    expect(resetFiltersMock).toHaveBeenCalledTimes(1);
  });

  it('builds mesh link with cluster hide filter for control planes with issues', async () => {
    const user = userEvent.setup();
    useControlPlanesMock.mockReturnValue({
      controlPlanes: [
        {
          cluster: { name: 'c2' },
          istiodName: 'istiod-2',
          status: Status.Unhealthy
        }
      ],
      isError: false,
      isLoading: false,
      refresh
    });

    renderComponent();

    await user.click(screen.getByTestId('control-planes-issues'));

    const link = await screen.findByRole('link', { name: /istiod-2/i });
    expect(link.textContent).toContain('istiod-2');
    expect(link.getAttribute('href')).toContain(`/${Paths.MESH}?`);
    expect(decodeURIComponent(link.getAttribute('href') as string)).toContain('meshHide=cluster!=c2');
  });
});
