import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { HealthIndicator } from '../HealthIndicator';
import { AppHealth, DEGRADED, FAILURE, HEALTHY, NOT_READY } from '../../../types/Health';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';
import { createIcon } from 'config/KialiIcon';

describe('HealthIndicator', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });
  it('renders when empty', () => {
    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" />);
    expect(wrapper.html()).not.toContain('pficon');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" />);
    expect(wrapper.html()).not.toContain('pficon');
  });

  it('renders healthy', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, syncedProxies: 1 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, syncedProxies: 2 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 600, hasSidecar: true, hasAmbient: false }
    );

    let wrapper = shallow(<HealthIndicator id="svc" health={health} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(HEALTHY)).html());
  });

  it('renders workloads degraded', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 10, syncedProxies: 1 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, syncedProxies: 2 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 600, hasSidecar: true, hasAmbient: false }
    );

    let wrapper = shallow(<HealthIndicator id="svc" health={health} />);
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(DEGRADED)).html());
  });

  it('renders some scaled down workload', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, syncedProxies: 0 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, syncedProxies: 2 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 600, hasSidecar: true, hasAmbient: false }
    );

    let wrapper = shallow(<HealthIndicator id="svc" health={health} />);
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(NOT_READY)).html());
  });

  it('renders all workloads down', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, syncedProxies: 0 },
        { name: 'B', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, syncedProxies: 0 }
      ],
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 600, hasSidecar: true, hasAmbient: false }
    );

    let wrapper = mount(<HealthIndicator id="svc" health={health} />);
    let html = wrapper.html();
    expect(html).toContain(mount(createIcon(NOT_READY)).html());
  });

  it('renders error rate failure', () => {
    const health = new AppHealth(
      'bookinfo',
      'reviews',
      [{ name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, syncedProxies: 1 }],
      {
        inbound: { http: { '200': 0.5, '500': 0.5 } },
        outbound: { http: { '500': 0.4, '200': 2 } },
        healthAnnotations: {}
      },
      { rateInterval: 600, hasSidecar: true, hasAmbient: false }
    );

    let wrapper = shallow(<HealthIndicator id="svc" health={health} />);
    let html = wrapper.html();
    expect(html).toContain(shallow(createIcon(FAILURE)).html());
  });

  describe('proxy status section', () => {
    it('renders the degraded workloads', () => {
      const health = new AppHealth(
        'bookinfo',
        'reviews',
        [
          {
            name: 'A',
            availableReplicas: 2,
            currentReplicas: 2,
            desiredReplicas: 2,
            syncedProxies: 1
          }
        ],
        { inbound: {}, outbound: {}, healthAnnotations: {} },
        { rateInterval: 600, hasSidecar: true, hasAmbient: false }
      );

      let wrapper = shallow(<HealthIndicator id="svc" health={health} />);
      let html = wrapper.html();
      expect(html).toContain(shallow(createIcon(DEGRADED)).html());
      expect(shallowToJson(wrapper)).toMatchSnapshot();
    });
  });
});
