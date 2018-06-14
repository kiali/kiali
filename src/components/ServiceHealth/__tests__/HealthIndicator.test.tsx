import * as React from 'react';
import { shallow } from 'enzyme';

import { HealthIndicator, DisplayMode } from '../HealthIndicator';
import { Health } from '../../../types/Health';

describe('HealthIndicator', () => {
  it('renders when empty', () => {
    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper.html()).not.toContain('pficon');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper.html()).not.toContain('pficon');
  });

  it('renders healthy', () => {
    const health: Health = {
      envoy: { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
  });

  it('renders deployments degraded', () => {
    const health: Health = {
      envoy: { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Pod deployment degraded');
  });

  it('renders envoy failure', () => {
    const health: Health = {
      envoy: { inbound: { healthy: 0, total: 10 }, outbound: { healthy: 1, total: 1 } },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health failure');
  });

  it('renders some scaled down deployment', () => {
    const health: Health = {
      envoy: { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 0 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('inactive deployment');
  });

  it('renders all deployments down', () => {
    const health: Health = {
      envoy: { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 0 }, { name: 'B', available: 0, replicas: 0 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('No active deployment');
  });

  it('renders error rate failure', () => {
    const health: Health = {
      envoy: { inbound: { healthy: 1, total: 10 }, outbound: { healthy: 1, total: 10 } },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }],
      requests: { requestCount: 1.56, requestErrorCount: 1.1 }
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.SMALL} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator id="svc" health={health} mode={DisplayMode.LARGE} rateInterval="" />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Error rate failure');
  });
});
