import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Status } from 'types/IstioStatus';
import { Paths } from 'config';

import { ControlPlaneStats } from '../ControlPlaneStats';

jest.mock('hooks/controlPlanes', () => ({
  useControlPlanes: jest.fn()
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
const resetFiltersMock = require('components/Filters/StatefulFilters').FilterSelected.resetFilters as jest.Mock;
const routerMock = require('app/History').router;

describe('Overview ControlPlaneStats', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mountComponent = (): ReactWrapper => {
    return mount(
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

    const wrapper = mountComponent();
    expect(wrapper.text()).toContain('Control planes');
    expect(wrapper.text()).toContain('Fetching control plane data');
  });

  it('renders error state and retries on try again', () => {
    useControlPlanesMock.mockReturnValue({
      controlPlanes: [],
      isError: true,
      isLoading: false,
      refresh
    });

    const wrapper = mountComponent();
    expect(wrapper.text()).toContain('Control planes could not be loaded');

    // OverviewCardErrorState uses a PF Button internally.
    wrapper.find('button').first().simulate('click');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders stats and navigates to namespaces on view button click', () => {
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

    const wrapper = mountComponent();

    expect(wrapper.text()).toContain('Control planes (2)');
    expect(wrapper.find('[data-test="control-planes-issues"]').text()).toContain('1');

    wrapper.find('button[data-test="control-planes-view-namespaces"]').simulate('click');
    expect(resetFiltersMock).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate as jest.Mock).toHaveBeenCalledTimes(1);

    const url = (routerMock.navigate as jest.Mock).mock.calls[0][0] as string;
    expect(url.startsWith(`/${Paths.NAMESPACES}?`)).toBeTruthy();
    expect(url).toMatch(/[?&]type=Control(\+|%20)plane/);
  });

  it('builds mesh link with cluster hide filter for control planes with issues', () => {
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

    const wrapper = mountComponent();

    const popover = wrapper.find('Popover[aria-label="Control planes with issues"]').first();
    expect(popover.exists()).toBeTruthy();

    const bodyContent = popover.prop('bodyContent') as any;
    const popoverBody = mount(<MemoryRouter>{bodyContent}</MemoryRouter>);

    const link = popoverBody.find('a').first();
    expect(link.text()).toContain('istiod-2');
    expect(link.prop('href')).toContain(`/${Paths.MESH}?`);
    expect(decodeURIComponent(link.prop('href') as string)).toContain('meshHide=cluster!=c2');
  });
});
