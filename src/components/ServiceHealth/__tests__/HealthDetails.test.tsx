import * as React from 'react';
import { shallow } from 'enzyme';

import { HealthDetails } from '../HealthDetails';
import { Health } from '../../../types/Health';

describe('HealthDetails', () => {
  it('renders healthy', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 1 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" rateInterval={600} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders envoy degraded', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" rateInterval={600} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders deployments failure', () => {
    const health: Health = {
      envoy: { healthy: 1, total: 10 },
      deploymentStatuses: [{ name: 'A', available: 0, replicas: 10 }, { name: 'B', available: 2, replicas: 2 }],
      requests: { requestCount: 0, requestErrorCount: 0 }
    };

    let wrapper = shallow(<HealthDetails id="svc" health={health} headline="" rateInterval={600} />);
    expect(wrapper).toMatchSnapshot();
  });
});
