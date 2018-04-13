import * as React from 'react';
import { shallow } from 'enzyme';

import { HealthDetails } from '../HealthDetails';
import { Health } from '../../../types/Health';

describe('HealthDetails', () => {
  it('renders healthy', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }]
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders deployments degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }]
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders envoy degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }]
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders deployments failure', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }]
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders envoy failure', () => {
    const health: Health = {
      envoy: { healthy: 0, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }]
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders all deployments down', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 0 }, { name: 'B', available: 0, replicas: 0 }]
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });
});
