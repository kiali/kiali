import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { HealthIndicator, DisplayMode } from '../HealthIndicator';
import { createIcon } from '../../../components/Health/Helper';
import { AppHealth, DEGRADED, FAILURE, HEALTHY, IDLE } from '../../../types/Health';
import { PFAlertColor } from 'components/Pf/PfColors';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';

describe('HealthIndicator', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });
  it('renders when empty', () => {
    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" mode={DisplayMode.SMALL} />);
    expect(wrapper.html()).not.toContain('pficon');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" mode={DisplayMode.LARGE} />);
    expect(wrapper.html()).not.toContain('pficon');
  });

  it('renders healthy', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2 }
      ],
      { inbound: {}, outbound: {} },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(HEALTHY, 'sm')).html());

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain(PFAlertColor.Success);
  });

  it('renders workloads degraded', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 10 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2 }
      ],
      { inbound: {}, outbound: {} },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(DEGRADED, 'sm')).html());

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain(PFAlertColor.Warning);
    expect(html).toContain('1 / 10');
  });

  it('renders some scaled down workload', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2 }
      ],
      { inbound: {}, outbound: {} },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(IDLE, 'sm')).html());

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain(PFAlertColor.InfoBackground);
    expect(html).toContain('0 / 0');
  });

  it('renders all workloads down', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0 },
        { name: 'B', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0 }
      ],
      { inbound: {}, outbound: {} },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = mount(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain(mount(createIcon(IDLE, 'sm')).html());

    // LARGE
    wrapper = mount(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain(PFAlertColor.InfoBackground);
  });

  it('renders error rate failure', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [{ name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1 }],
      {
        inbound: { http: { '200': 0.5, '500': 0.5 } },
        outbound: { http: { '500': 0.4, '200': 2 } }
      },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(FAILURE, 'sm')).html());

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain(PFAlertColor.Danger);
    expect(html).toContain('Outbound: 16.67%');
    expect(html).toContain('Inbound: 26.47%');
  });
});
