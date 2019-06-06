import * as React from 'react';
import { shallow } from 'enzyme';
import ItemDescription from '../ItemDescription';
import { ServiceHealth } from '../../../types/Health';
import { ServiceListItem } from '../../../types/ServiceList';
import { ObjectValidation } from '../../../types/IstioObjects';

const health = new ServiceHealth(
  { errorRatio: 0.1, inboundErrorRatio: 0.17, outboundErrorRatio: -1 },
  { rateInterval: 60, hasSidecar: true }
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
      healthPromise: new Promise<ServiceHealth>(r => (resolver = r)),
      validation: {} as ObjectValidation
    };
  });

  it('should render with promise resolving', () => {
    const wrapper = shallow(<ItemDescription item={item} />);
    expect(wrapper.text()).toBe('');
    resolver(health);
    return new Promise(r => setImmediate(r)).then(() => {
      wrapper.update();
      expect(wrapper.find('HealthIndicator')).toHaveLength(1);
    });
  });
});
