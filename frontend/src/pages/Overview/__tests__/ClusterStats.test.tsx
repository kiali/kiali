import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Status } from 'types/IstioStatus';
import { Paths } from 'config';

import { ClusterStats } from '../ClusterStats';

jest.mock('hooks/clusters', () => ({
  useClusterStatus: jest.fn()
}));

jest.mock('utils/MeshUtils', () => ({
  isControlPlaneAccessible: jest.fn()
}));

const useClusterStatusMock = require('hooks/clusters').useClusterStatus as jest.Mock;
const isControlPlaneAccessibleMock = require('utils/MeshUtils').isControlPlaneAccessible as jest.Mock;

describe('Overview ClusterStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mountComponent = (): ReactWrapper => {
    return mount(
      <MemoryRouter>
        <ClusterStats />
      </MemoryRouter>
    );
  };

  it('renders spinner while loading', () => {
    isControlPlaneAccessibleMock.mockReturnValue(true);
    useClusterStatusMock.mockReturnValue({
      isLoading: true,
      statusMap: { c1: [{ cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy }] }
    });

    const wrapper = mountComponent();

    expect(wrapper.find('[role="progressbar"]').exists()).toBeTruthy();
  });

  it('shows total/healthy/unhealthy counters and builds mesh links for clusters with issues', () => {
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

    const wrapper = mountComponent();

    // Total clusters = 4
    expect(wrapper.text()).toContain('Clusters (4)');

    // Known issues exist (Unreachable/Unhealthy) -> triangle icon (even if unknown issues also exist)
    expect(wrapper.find('ExclamationTriangleIcon').exists()).toBeTruthy();
    expect(wrapper.find('UnknownIcon').exists()).toBeFalsy();

    // Healthy clusters: c1 only => 1
    expect(wrapper.text()).toContain('1');

    // Unhealthy clusters: c2 and c3 => 2 (shown as issues trigger)
    expect(wrapper.find('[data-test="clusters-issues"]').text()).toContain('3');

    const popover = wrapper.find('Popover[aria-label="Clusters with issues"]').first();
    expect(popover.exists()).toBeTruthy();

    const bodyContent = popover.prop('bodyContent') as any;
    const popoverBody = mount(<MemoryRouter>{bodyContent}</MemoryRouter>);

    const links = popoverBody.find('a');
    expect(links.someWhere(a => (a.prop('href') as string).includes(`/${Paths.MESH}?cluster=c2`))).toBeTruthy();
    expect(links.someWhere(a => (a.prop('href') as string).includes(`/${Paths.MESH}?cluster=c3`))).toBeTruthy();
    expect(links.someWhere(a => (a.prop('href') as string).includes(`/${Paths.MESH}?cluster=c4`))).toBeTruthy();

    // NotFound status should render Unknown status instead of "1 issue"
    expect(popoverBody.text()).toContain('Unknown status');

    // Footer "View Mesh" link
    const footerLink = wrapper.find(`a[href="/${Paths.MESH}"]`).first();
    expect(footerLink.exists()).toBeTruthy();
  });

  it('uses unknown icon when issues are only unknown', () => {
    isControlPlaneAccessibleMock.mockReturnValue(true);
    useClusterStatusMock.mockReturnValue({
      isLoading: false,
      statusMap: {
        c1: [{ cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy }],
        c2: [{ cluster: 'c2', isCore: true, name: 'istiod', status: Status.NotFound }]
      }
    });

    const wrapper = mountComponent();
    expect(wrapper.find('[data-test="clusters-issues"]').text()).toContain('1');
    expect(wrapper.find('UnknownIcon').exists()).toBeTruthy();
    expect(wrapper.find('ExclamationTriangleIcon').exists()).toBeFalsy();
  });

  it('hides mesh links when control plane is not accessible', () => {
    isControlPlaneAccessibleMock.mockReturnValue(false);
    useClusterStatusMock.mockReturnValue({
      isLoading: false,
      statusMap: {
        c1: [{ cluster: 'c1', isCore: true, name: 'istiod', status: Status.Healthy }],
        c2: [{ cluster: 'c2', isCore: true, name: 'istiod', status: Status.Unhealthy }]
      }
    });

    const wrapper = mountComponent();

    // Footer "View Mesh" link should be hidden
    expect(wrapper.find(`a[href="/${Paths.MESH}"]`).exists()).toBeFalsy();

    // Popover body should not contain mesh links for clusters
    const popover = wrapper.find('Popover[aria-label="Clusters with issues"]').first();
    expect(popover.exists()).toBeTruthy();

    const bodyContent = popover.prop('bodyContent') as any;
    const popoverBody = mount(<MemoryRouter>{bodyContent}</MemoryRouter>);
    expect(popoverBody.find('a').exists()).toBeFalsy();
  });
});
