import * as React from 'react';
import { shallow } from 'enzyme';
import ItemDescription from '../ItemDescription';
import { Health } from '../../../types/Health';
import { ServiceItem } from '../../../types/ServiceListComponent';

const health: Health = {
  envoy: { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
  deploymentStatuses: [{ name: 'A', available: 1, replicas: 1 }, { name: 'B', available: 2, replicas: 2 }],
  requests: { requestCount: 10, requestErrorCount: 1 }
};

describe('ItemDescription', () => {
  let resolver;
  let item: ServiceItem;

  beforeEach(() => {
    resolver = undefined;
    item = {
      name: 'svc',
      namespace: 'ns',
      istioSidecar: false,
      healthPromise: new Promise<Health>(r => (resolver = r))
    };
  });

  it('should render with promise resolving', done => {
    const wrapper = shallow(<ItemDescription item={item} rateInterval={60} />);
    expect(wrapper.text()).toBe('');

    resolver(health);
    item.healthPromise.then(() => {
      wrapper.update();
      expect(wrapper.text()).toBe('Health: <HealthIndicator /><ServiceErrorRate />');
      done();
    });
  });
});
