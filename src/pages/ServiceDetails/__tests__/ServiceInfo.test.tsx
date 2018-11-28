import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfo from '../ServiceInfo';
import { hasIstioSidecar, ServiceDetailsInfo } from '../../../types/ServiceInfo';
import { Validations } from '../../../types/IstioObjects';

jest.mock('../../../services/Api');

const API = require('../../../services/Api');

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo with data', () => {
    return API.getServiceDetail('istio-system', 'reviews').then(response => {
      const data = response.data;
      const serviceDetailsInfo: ServiceDetailsInfo = {
        service: {
          labels: data.labels,
          name: data.name,
          createdAt: data.createdAt,
          resourceVersion: data.resourceVersion,
          type: data.type,
          ports: data.ports,
          ip: data.ip
        },
        endpoints: data.endpoints,
        istioSidecar: hasIstioSidecar(data.deployments),
        dependencies: data.dependencies,
        virtualServices: data.virtualServices,
        destinationRules: data.destinationRules,
        health: data.health
      };

      const validations: Validations = {
        destinationrule: {
          reviews: {
            name: 'details',
            objectType: 'destinationrule',
            valid: false,
            checks: [
              { message: 'This subset is not found from the host', severity: 'error', path: 'spec/subsets[0]/version' },
              { message: 'This subset is not found from the host', severity: 'error', path: 'spec/subsets[1]/version' }
            ]
          }
        }
      };

      const wrapper = shallow(
        <ServiceInfo
          namespace="istio-system"
          service="reviews"
          serviceDetails={serviceDetailsInfo}
          validations={validations}
          onRefresh={jest.fn()}
          onSelectTab={jest.fn()}
          activeTab={jest.fn()}
        />
      );
      expect(wrapper).toBeDefined();
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('ServiceInfoDescription').length === 1).toBeTruthy();
      expect(wrapper.find('InfoRoutes').length === 1).toBeFalsy();
      expect(wrapper.find('ServiceInfoVirtualServices').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoDestinationRules').length === 1).toBeTruthy();
    });
  });
});
