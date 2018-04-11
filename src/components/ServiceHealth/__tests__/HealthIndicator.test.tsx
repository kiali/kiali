import * as React from 'react';
import { shallow } from 'enzyme';

import { HealthIndicator, DisplayMode } from '../HealthIndicator';
import { Health } from '../../../types/Health';

describe('HealthIndicator', () => {
  it('renders when empty', () => {
    // SMALL
    let wrapper = shallow(<HealthIndicator mode={DisplayMode.SMALL} />);
    expect(wrapper.html()).not.toContain('pficon');

    // LARGE
    wrapper = shallow(<HealthIndicator mode={DisplayMode.LARGE} />);
    expect(wrapper.html()).not.toContain('pficon');
  });

  it('renders healthy', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
  });

  it('renders deployments degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Pod deployment degraded');
  });

  it('renders envoy degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Envoy health degraded');
  });

  it('renders both degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 10 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health degraded');
  });

  it('renders deployments failure', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Pod deployment failure');
    expect(html).toContain('Envoy health degraded');
  });

  it('renders envoy failure', () => {
    const health: Health = {
      envoy: { healthy: 0, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health failure');
  });

  it('renders some scaled down deployment', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 0 }, { name: 'B', available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('inactive deployment');
  });

  it('renders all deployments down', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 0 }, { name: 'B', available: 0, replicas: 0 }]
    };

    // SMALL
    let wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');

    // LARGE
    wrapper = shallow(<HealthIndicator health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('No active deployment');
  });
});
