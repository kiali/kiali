import * as React from 'react';
import ServiceInfo from '../ServiceInfo';
import MounterMocker from 'services/__mocks__/MounterMocker';
import { SERVICE_DETAILS } from '../../../services/__mockData__/getServiceDetail';

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo with data', done => {
    const serviceInfo = (
      <ServiceInfo
        namespace="istio-system"
        service="reviews"
        gateways={[]}
        peerAuthentications={[]}
        validations={{}}
        serviceDetails={SERVICE_DETAILS}
      />
    );
    new MounterMocker().mountWithStore(serviceInfo).run(done, wrapper => {
      expect(wrapper.find('ServiceInfoDescription')).toHaveLength(1);
      expect(wrapper.find('div#name').text()).toContain('reviews');
      expect(wrapper.find('div#endpoints').find('StackItem')).toHaveLength(3);
      const tabs = wrapper.find('div#service-tabs').find('li');
      expect(tabs).toHaveLength(2);
      expect(tabs.at(0).text().trim()).toEqual('Workloads (0)');
      expect(tabs.at(1).text().trim()).toEqual('Istio Config (2)');
    });
  });
});
