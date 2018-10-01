import * as React from 'react';
import { shallow } from 'enzyme';
import ItemDescription from '../ItemDescription';
import { ServiceHealth } from '../../../types/Health';
import { ServiceListItem } from '../../../types/ServiceList';

const health = new ServiceHealth(
  { inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } },
  { requestCount: 10, requestErrorCount: 1 },
  60
);

describe('ItemDescription', () => {
  let resolver;
  let item: ServiceListItem;

  beforeEach(() => {
    resolver = undefined;
    item = {
      name: 'svc',
      namespace: 'ns',
      istioSidecar: false,
      healthPromise: new Promise<ServiceHealth>(r => (resolver = r))
    };
  });

  it('should render with promise resolving', () => {
    const wrapper = shallow(<ItemDescription item={item} />);
    expect(wrapper.text()).toBe('');

    resolver(health);
    return new Promise(r => setImmediate(r)).then(() => {
      wrapper.update();
      expect(wrapper.text()).toBe('Health: <HealthIndicator /><ServiceErrorRate />');
    });
  });
});
