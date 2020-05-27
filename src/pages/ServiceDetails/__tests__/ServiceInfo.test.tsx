import * as React from 'react';
import ServiceInfo from '../ServiceInfo';
import MounterMocker from 'services/__mocks__/MounterMocker';
import { SERVICE_DETAILS } from 'services/__mockData__/getServiceDetail';

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo with data', done => {
    new MounterMocker()
      .addMock('getServiceDetail', SERVICE_DETAILS, false)
      .mountWithStore(<ServiceInfo namespace="istio-system" service="reviews" duration={600} />)
      .run(done, wrapper => {
        expect(wrapper.find('ServiceInfoDescription')).toHaveLength(1);
        expect(wrapper.find('div#name').text()).toContain('reviews');
        expect(wrapper.find('div#endpoints').find('StackItem')).toHaveLength(3);
        const tabs = wrapper.find('div#service-tabs').find('li');
        expect(tabs).toHaveLength(3);
        expect(tabs.at(0).text().trim()).toEqual('Workloads (0)');
        expect(tabs.at(1).text().trim()).toEqual('Virtual Services (1)');
        expect(tabs.at(2).text().trim()).toEqual('Destination Rules (1)');
      });
  });
});
