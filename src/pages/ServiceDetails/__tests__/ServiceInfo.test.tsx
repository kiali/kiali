import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfo from '../ServiceInfo';
import { hasIstioSidecar, ServiceDetailsInfo } from '../../../types/ServiceInfo';

jest.mock('../../../services/Api');

const API = require('../../../services/Api');

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo with data', () => {
    return API.getServiceDetail('istio-system', 'reviews').then(response => {
      const data = response.data;
      const serviceDetailsInfo: ServiceDetailsInfo = {
        labels: data.labels,
        name: data.name,
        createdAt: data.createdAt,
        resourceVersion: data.resourceVersion,
        type: data.type,
        ports: data.ports,
        endpoints: data.endpoints,
        istioSidecar: hasIstioSidecar(data.deployments),
        deployments: data.deployments,
        dependencies: data.dependencies,
        virtualServices: data.virtualServices,
        destinationRules: data.destinationRules,
        ip: data.ip,
        health: data.health
      };

      const wrapper = shallow(
        <ServiceInfo
          namespace="istio-system"
          service="reviews"
          serviceDetails={serviceDetailsInfo}
          validations={{}}
          onRefresh={jest.fn()}
        />
      );
      expect(wrapper).toBeDefined();
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('ServiceInfoDescription').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoDeployments').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoRoutes').length === 1).toBeFalsy();
      expect(wrapper.find('ServiceInfoVirtualServices').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoDestinationRules').length === 1).toBeTruthy();
    });
  });
});
