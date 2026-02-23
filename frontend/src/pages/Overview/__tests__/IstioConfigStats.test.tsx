import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
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
const routerMock = require('app/History').router;

describe('Overview IstioConfigStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mountComponent = (): ReactWrapper => {
    return mount(
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

    let wrapper = mountComponent();
    expect(wrapper.text()).toContain('Istio configs');
    expect(wrapper.text()).toContain('Fetching Istio config data');

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

    wrapper = mountComponent();
    expect(wrapper.text()).toContain('Istio configs could not be loaded');
  });

  it('navigates to Istio list with all known namespaces on footer click', () => {
    // First selector call = namespaceItems, second = activeNamespaces
    useKialiSelectorMock
      .mockReturnValueOnce([{ name: 'b' }, { name: 'a' }, { name: 'a' }]) // namespaceItems (de-duped + sorted)
      .mockReturnValueOnce([{ name: 'ignored' }]); // activeNamespaces

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

    const wrapper = mountComponent();
    expect(wrapper.text()).toContain('Istio configs (10)');

    wrapper
      .find('button')
      .filterWhere(b => b.text().includes('View Istio config'))
      .first()
      .simulate('click');

    expect(resetFiltersMock).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate as jest.Mock).toHaveBeenCalledTimes(1);
    const url = (routerMock.navigate as jest.Mock).mock.calls[0][0] as string;

    expect(url.startsWith(`/${Paths.ISTIO}?`)).toBeTruthy();
    // namespaces should be "a,b" (sorted, deduped)
    expect(decodeURIComponent(url)).toContain('namespaces=a,b');
  });

  it('adds config status filters when clicking "View warning Istio configs" in the popover footer', () => {
    useKialiSelectorMock
      .mockReturnValueOnce([{ name: 'ns1' }]) // namespaceItems
      .mockReturnValueOnce([{ name: 'ns2' }]); // activeNamespaces (unused because namespaceItems is non-empty)

    useIstioConfigStatusMock.mockReturnValue({
      errors: 0,
      isError: false,
      isLoading: false,
      issues: [
        // 4 issues ensures popover footer button is rendered (MAX=3)
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

    const wrapper = mountComponent();

    const popover = wrapper.find('Popover[aria-label="Istio configs with warnings"]').first();
    expect(popover.exists()).toBeTruthy();

    const bodyContent = popover.prop('bodyContent') as any;
    const popoverBody = mount(<MemoryRouter>{bodyContent}</MemoryRouter>);

    popoverBody
      .find('button')
      .filterWhere(b => b.text().includes('View warning Istio configs'))
      .first()
      .simulate('click');

    expect(resetFiltersMock).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate as jest.Mock).toHaveBeenCalledTimes(1);

    const url = (routerMock.navigate as jest.Mock).mock.calls[0][0] as string;
    expect(url.startsWith(`/${Paths.ISTIO}?`)).toBeTruthy();

    const decoded = decodeURIComponent(url);
    // status filter list should include Warning and Not Validated; order doesn't matter
    expect(decoded).toContain(`config=${IstioConfigStatusLabel.Warning}`);
    // URLSearchParams encodes spaces as '+' (or sometimes '%20' depending on context)
    expect(decoded).toMatch(/[?&]config=Not(\+|%20)Validated/);
    expect(decoded).toContain('opLabel=or');
    expect(decoded).toContain('namespaces=ns1');
  });
});
