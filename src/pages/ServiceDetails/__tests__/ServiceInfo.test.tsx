import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfo from '../ServiceInfo';
import { HasIstioSidecar } from '../../../types/ServiceInfo';

jest.mock('../../../services/Api');

const API = require('../../../services/Api');

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo', () => {
    const wrapper = shallow(<ServiceInfo namespace="istio-system" service="reviews" />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('ServiceInfoDescription').length === 1).toBeTruthy();
    expect(wrapper.find('ServiceInfoDeployments').length === 1).toBeFalsy();
    expect(wrapper.find('ServiceInfoRoutes').length === 1).toBeFalsy();
    expect(wrapper.find('ServiceInfoRouteRules').length === 1).toBeFalsy();
    expect(wrapper.find('ServiceInfoDestinationPolicies').length === 1).toBeFalsy();
  });

  it('should render serviceInfo with data', () => {
    return API.GetServiceDetail('istio-system', 'reviews').then(response => {
      let data = response;
      const wrapper = shallow(<ServiceInfo namespace="istio-system" service="reviews" />).setState({
        labels: data.labels,
        name: data.name,
        type: data.type,
        ports: data.ports,
        endpoints: data.endpoints,
        istio_sidecar: HasIstioSidecar(data.deployments),
        deployments: data.deployments,
        dependencies: data.dependencies,
        routeRules: data.route_rules,
        destinationPolicies: data.destination_policies,
        ip: data.ip,
        health: data.health
      });
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
