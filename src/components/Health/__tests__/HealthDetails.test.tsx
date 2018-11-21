import * as React from 'react';
import { shallow } from 'enzyme';

import { HealthDetails } from '../HealthDetails';
import { ServiceHealth } from '../../../types/Health';

describe('HealthDetails', () => {
  it('renders healthy', () => {
    const health = new ServiceHealth(
      { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      60
    );

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders envoy degraded', () => {
    const health = new ServiceHealth(
      { inbound: { healthy: 1, total: 10 }, outbound: { healthy: 1, total: 1 } },
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      60
    );

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders deployments failure', () => {
    const health = new ServiceHealth(
      { inbound: { healthy: 1, total: 10 }, outbound: { healthy: 1, total: 1 } },
      { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
      60
    );

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" />);
    expect(wrapper).toMatchSnapshot();
  });
});
