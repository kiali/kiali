import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Paths } from 'config';
import type { Mock } from '@rstest/core';

import { IstioConfigStats } from '../IstioConfigStats';
import { IstioConfigStatusLabel } from 'hooks/istioConfigs';

rstest.mock('hooks/istioConfigs', () => ({
  IstioConfigStatusLabel: {
    Warning: 'Warning',
    NotValid: 'Not Valid',
    NotValidated: 'Not Validated'
  },
  useIstioConfigStatus: rstest.fn()
}));

rstest.mock('hooks/redux', () => ({
  useKialiSelector: rstest.fn()
}));

rstest.mock('components/Filters/StatefulFilters', () => ({
  FilterSelected: { resetFilters: rstest.fn() }
}));

rstest.mock('app/History', () => ({
  router: { navigate: rstest.fn() }
}));

const useIstioConfigStatusMock = require('hooks/istioConfigs').useIstioConfigStatus as Mock;
const useKialiSelectorMock = require('hooks/redux').useKialiSelector as Mock;
const resetFiltersMock = require('components/Filters/StatefulFilters').FilterSelected.resetFilters as Mock;

describe('Overview IstioConfigStats', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    useKialiSelectorMock.mockReturnValue('');
  });

  const renderComponent = (): void => {
    render(
      <MemoryRouter>
        <IstioConfigStats />
      </MemoryRouter>
    );
  };

  it('renders loading and error states', () => {
    useKialiSelectorMock.mockReturnValueOnce([]).mockReturnValueOnce([]);
    useIstioConfigStatusMock.mockReturnValue({
      errors: 0,
      isError: false,
      isLoading: true,
      issues: [],
      refresh: rstest.fn(),
      total: 0,
      valid: 0,
      warnings: 0
    });

    renderComponent();
    expect(screen.getByText(/istio configs/i)).toBeInTheDocument();
    expect(screen.getByText(/fetching istio config data/i)).toBeInTheDocument();

    useKialiSelectorMock.mockReturnValueOnce([]).mockReturnValueOnce([]);
    const refresh = rstest.fn();
    useIstioConfigStatusMock.mockReturnValue({
      errors: 0,
      isError: true,
      isLoading: false,
      issues: [],
      refresh,
      total: 0,
      valid: 0,
      warnings: 0
    });

    renderComponent();
    expect(screen.getByText(/istio configs could not be loaded/i)).toBeInTheDocument();
  });

  it('navigates to Istio list with all known namespaces on footer click', async () => {
    const user = userEvent.setup();
    useKialiSelectorMock
      .mockReturnValueOnce([{ name: 'b' }, { name: 'a' }, { name: 'a' }])
      .mockReturnValueOnce([{ name: 'ignored' }]);

    useIstioConfigStatusMock.mockReturnValue({
      errors: 0,
      isError: false,
      isLoading: false,
      issues: [],
      refresh: rstest.fn(),
      total: 10,
      valid: 10,
      warnings: 0
    });

    renderComponent();
    expect(screen.getByText(/istio configs \(10\)/i)).toBeInTheDocument();

    const viewLink = screen.getByRole('link', { name: /view istio config/i });
    const url = viewLink.getAttribute('href') ?? '';
    expect(url.startsWith(`/${Paths.ISTIO}?`)).toBeTruthy();
    expect(decodeURIComponent(url)).toContain('namespaces=a,b');

    await user.click(viewLink);
    expect(resetFiltersMock).toHaveBeenCalledTimes(1);
  });

  it('adds config status filters when clicking "View warning Istio configs" in the popover footer', async () => {
    const user = userEvent.setup();
    useKialiSelectorMock.mockReturnValueOnce([{ name: 'ns1' }]).mockReturnValueOnce([{ name: 'ns2' }]);

    useIstioConfigStatusMock.mockReturnValue({
      errors: 0,
      isError: false,
      isLoading: false,
      issues: [
        {
          apiVersion: 'networking.istio.io/v1',
          cluster: 'c1',
          kind: 'VirtualService',
          name: 'vs1',
          namespace: 'ns1',
          severity: 'warning',
          status: 'Warning'
        },
        {
          apiVersion: 'networking.istio.io/v1',
          cluster: 'c1',
          kind: 'DestinationRule',
          name: 'dr1',
          namespace: 'ns1',
          severity: 'warning',
          status: 'Warning'
        },
        {
          apiVersion: 'networking.istio.io/v1',
          cluster: 'c1',
          kind: 'Gateway',
          name: 'gw1',
          namespace: 'ns1',
          severity: 'warning',
          status: 'Not Validated'
        },
        {
          apiVersion: 'networking.istio.io/v1',
          cluster: 'c1',
          kind: 'ServiceEntry',
          name: 'se1',
          namespace: 'ns1',
          severity: 'warning',
          status: 'Not Validated'
        }
      ],
      refresh: rstest.fn(),
      total: 4,
      valid: 0,
      warnings: 4
    });

    renderComponent();

    await user.click(screen.getByTestId('istio-configs-warnings'));

    const viewLink = await screen.findByRole('link', { name: /view warning istio configs/i });
    const url = viewLink.getAttribute('href') ?? '';
    expect(url.startsWith(`/${Paths.ISTIO}?`)).toBeTruthy();

    const decoded = decodeURIComponent(url);
    expect(decoded).toContain(`config=${IstioConfigStatusLabel.Warning}`);
    expect(decoded).toMatch(/[?&]config=Not(\+|%20)Validated/);
    expect(decoded).toContain('opLabel=or');
    expect(decoded).toContain('namespaces=ns1');

    await user.click(viewLink);
    expect(resetFiltersMock).toHaveBeenCalledTimes(1);
  });
});
