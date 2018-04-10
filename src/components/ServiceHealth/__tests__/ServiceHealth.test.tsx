import * as React from 'react';
import { shallow } from 'enzyme';

import { ServiceHealth, DisplayMode } from '../ServiceHealth';
import { Health } from '../../../types/Health';

describe('ServiceHealth', () => {
  it('renders when empty', () => {
    // SMALL
    let wrapper = shallow(<ServiceHealth mode={DisplayMode.SMALL} />);
    expect(wrapper.html()).not.toContain('pficon');

    // LARGE
    wrapper = shallow(<ServiceHealth mode={DisplayMode.LARGE} />);
    expect(wrapper.html()).not.toContain('pficon');
  });

  it('renders healthy', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ available: 1, replicas: 1 }, { available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('Healthy');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('Healthy');
  });

  it('renders deployments degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ available: 1, replicas: 10 }, { available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Degraded');
    expect(html).toContain('Pod deployment degraded');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Degraded');
    expect(html).toContain('Pod deployment degraded');
  });

  it('renders envoy degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ available: 1, replicas: 1 }, { available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Degraded');
    expect(html).toContain('Envoy health degraded');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Degraded');
    expect(html).toContain('Envoy health degraded');
  });

  it('renders both degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ available: 1, replicas: 10 }, { available: 2, replicas: 10 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Degraded');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health degraded');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-warning');
    expect(html).toContain('Degraded');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health degraded');
  });

  it('renders deployments failure', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ available: 0, replicas: 10 }, { available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Failure');
    expect(html).toContain('Pod deployment failure');
    expect(html).toContain('Envoy health degraded');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Failure');
    expect(html).toContain('Pod deployment failure');
    expect(html).toContain('Envoy health degraded');
  });

  it('renders envoy failure', () => {
    const health: Health = {
      envoy: { healthy: 0, total: 10 },
      deploymentStatuses: [{ available: 1, replicas: 10 }, { available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Failure');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health failure');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Failure');
    expect(html).toContain('Pod deployment degraded');
    expect(html).toContain('Envoy health failure');
  });

  it('renders some scaled down deployment', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ available: 0, replicas: 0 }, { available: 2, replicas: 2 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('Healthy');
    expect(html).toContain('inactive deployment');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-ok');
    expect(html).toContain('Healthy');
    expect(html).toContain('inactive deployment');
  });

  it('renders all deployments down', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ available: 0, replicas: 0 }, { available: 0, replicas: 0 }]
    };

    // SMALL
    let wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.SMALL} />);
    expect(wrapper).toMatchSnapshot();
    let html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Failure');
    expect(html).toContain('No active deployment');

    // LARGE
    wrapper = shallow(<ServiceHealth health={health} mode={DisplayMode.LARGE} />);
    expect(wrapper).toMatchSnapshot();
    html = wrapper.html();
    expect(html).toContain('pficon-error');
    expect(html).toContain('Failure');
    expect(html).toContain('No active deployment');
  });
});
