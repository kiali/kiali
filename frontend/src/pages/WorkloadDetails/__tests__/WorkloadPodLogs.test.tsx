import * as React from 'react';
import { mount, shallow } from 'enzyme';
import screenfull, { Screenfull } from 'screenfull';
import { WorkloadPodLogs } from '../WorkloadPodLogs';
import { Dropdown, DropdownItem, KebabToggle } from '@patternfly/react-core';

const defaultProps = () => ({
  lastRefreshAt: 200,
  timeRange: {},
  namespace: 'namespace',
  workload: 'workload',
  pods: [
    {
      name: 'testingpod',
      createdAt: 'anytime',
      createdBy: [],
      status: 'any',
      appLabel: false,
      versionLabel: false,
      containers: [{ name: 'busybox', image: 'busybox:v1', isProxy: false, isReady: true }],
      istioContainers: [{ name: 'istio-proxy', image: 'istio:latest', isProxy: true, isReady: true }],
      serviceAccountName: 'namespace-testingpod'
    }
  ]
});

describe('WorkloadPodLogs', () => {
  beforeEach(() => {
    jest.mock('screenfull');

    (screenfull as Screenfull).onchange = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders', () => {
    const wrapper = shallow(<WorkloadPodLogs {...defaultProps()} />);
    expect(wrapper.exists()).toBeTruthy();
  });

  it('renders a kebab toggle dropdown', () => {
    const wrapper = shallow(<WorkloadPodLogs {...defaultProps()} />);
    const kebabDropdownWrapper = wrapper
      .find(Dropdown)
      .findWhere(n => n.prop('toggle') && n.prop('toggle').type === KebabToggle);
    expect(wrapper.find(Dropdown).exists()).toBeTruthy();
    expect(kebabDropdownWrapper.exists()).toBeTruthy();
  });

  it('renders a log level action in the kebab', () => {
    // using 'mount' since the dropdowns are children of the kebab
    const wrapper = mount(<WorkloadPodLogs {...defaultProps()} />);
    wrapper.setState({ kebabOpen: true });
    expect(
      wrapper
        .find(DropdownItem)
        .findWhere(n => n.key() === 'setLogLevelDebug')
        .exists()
    ).toBeTruthy();
  });

  it('does not render log level actions in the kebab when proxy not present', () => {
    let props = defaultProps();
    props.pods[0].istioContainers = [];
    const wrapper = mount(<WorkloadPodLogs {...props} />);
    wrapper.setState({ kebabOpen: true });
    expect(
      wrapper
        .find(DropdownItem)
        .findWhere(n => n.key() === 'setLogLevelDebug')
        .exists()
    ).toBeFalsy();
  });

  it('calls set log level when action selected', () => {
    const api = require('../../../services/Api');
    const spy = jest.spyOn(api, 'setPodEnvoyProxyLogLevel');

    const wrapper = mount(<WorkloadPodLogs {...defaultProps()} />);
    wrapper.setState({ kebabOpen: true });
    wrapper
      .find(DropdownItem)
      .findWhere(n => n.key() === 'setLogLevelDebug')
      .simulate('click');
    expect(spy).toHaveBeenCalled();
  });
});
