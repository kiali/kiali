import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfo from '../ServiceInfo';
import { hasIstioSidecar, ObjectValidation, ServiceDetailsInfo } from '../../../types/ServiceInfo';

jest.mock('../../../services/Api');

const API = require('../../../services/Api');

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo with data', () => {
    return API.getServiceDetail('istio-system', 'reviews').then(response => {
      let data = response['data'];
      let serviceDetailsInfo: ServiceDetailsInfo = {
        labels: data.labels,
        name: data.name,
        created_at: data.created_at,
        resource_version: data.resource_version,
        type: data.type,
        ports: data.ports,
        endpoints: data.endpoints,
        istio_sidecar: hasIstioSidecar(data.deployments),
        deployments: data.deployments,
        dependencies: data.dependencies,
        routeRules: data.route_rules,
        destinationPolicies: data.destination_policies,
        virtualServices: data.virtual_services,
        destinationRules: data.destination_rules,
        ip: data.ip,
        health: data.health
      };
      let validations: Map<string, ObjectValidation> = new Map<string, ObjectValidation>();

      const wrapper = shallow(
        <ServiceInfo
          namespace="istio-system"
          service="reviews"
          serviceDetails={serviceDetailsInfo}
          validations={validations}
        />
      );
      expect(wrapper).toBeDefined();
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('ServiceInfoDescription').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoDeployments').length === 1).toBeFalsy();
      expect(wrapper.find('ServiceInfoRoutes').length === 1).toBeFalsy();
      expect(wrapper.find('ServiceInfoRouteRules').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoDestinationPolicies').length === 1).toBeFalsy();
    });
  });
});
