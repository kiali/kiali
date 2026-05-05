import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Paths } from 'config';

import { IstioConfigStats } from '../IstioConfigStats';
import { IstioConfigStatusLabel } from 'hooks/istioConfigs';

jest.mock('hooks/istioConfigs', () => ({
  IstioConfigStatusLabel: {
    Warning: 'Warning',
    NotValid: 'Not Valid',
    NotValidated: 'Not Validated'
  },
  useIstioConfigStatus: jest.fn()
}));

jest.mock('hooks/redux', () => ({
  useKialiSelector: jest.fn()
}));

jest.mock('components/Filters/StatefulFilters', () => ({
  FilterSelected: { resetFilters: jest.fn() }
}));

jest.mock('app/History', () => ({
  router: { navigate: jest.fn() }
}));

const useIstioConfigStatusMock = require('hooks/istioConfigs').useIstioConfigStatus as jest.Mock;
const useKialiSelectorMock = require('hooks/redux').useKialiSelector as jest.Mock;
const resetFiltersMock = require('components/Filters/StatefulFilters').FilterSelected.resetFilters as jest.Mock;

describe('Overview IstioConfigStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      refresh: jest.fn(),
      total: 0,
      valid: 0,
      warnings: 0
    });

    renderComponent();
    expect(screen.getByText(/istio configs/i)).toBeInTheDocument();
    expect(screen.getByText(/fetching istio config data/i)).toBeInTheDocument();

    useKialiSelectorMock.mockReturnValueOnce([]).mockReturnValueOnce([]);
    const refresh = jest.fn();
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
      refresh: jest.fn(),
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
      refresh: jest.fn(),
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
