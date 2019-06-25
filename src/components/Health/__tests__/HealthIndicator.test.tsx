import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { HealthIndicator, DisplayMode } from '../HealthIndicator';
import { AppHealth } from '../../../types/Health';

describe('HealthIndicator', () => {
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
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2 }
      ],
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
  });

  it('renders workloads degraded', () => {
    const health = new AppHealth(
      [
        { name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 10 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2 }
      ],
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('1 / 10');
  });

  it('renders some scaled down workload', () => {
    const health = new AppHealth(
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0 },
        { name: 'B', availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2 }
      ],
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('0 / 0');
  });

  it('renders all workloads down', () => {
    const health = new AppHealth(
      [
        { name: 'A', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0 },
        { name: 'B', availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0 }
      ],
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain('pficon-error');
  });

  it('renders error rate failure', () => {
    const health = new AppHealth(
      [{ name: 'A', availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1 }],
      { errorRatio: 0.3, inboundErrorRatio: 0.1, outboundErrorRatio: 0.2 },
      { rateInterval: 600, hasSidecar: true }
    );

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} />);
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} />);
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Outbound: 20.00%');
    expect(html).toContain('Inbound: 10.00%');
  });
});
