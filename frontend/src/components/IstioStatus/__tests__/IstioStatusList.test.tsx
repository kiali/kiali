import * as React from 'react';
import { shallow } from 'enzyme';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatusList } from '../IstioStatusList';
import { shallowToJson } from 'enzyme-to-json';
import { CLUSTER_DEFAULT } from '../../../types/Graph';

it('lists all the components grouped', () => {
  const components: ComponentStatus[] = [
    {
      cluster: CLUSTER_DEFAULT,
      name: 'grafana',
      status: Status.NotFound,
      is_core: false
    },
    {
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.Unhealthy,
      is_core: false
    },
    {
      cluster: CLUSTER_DEFAULT,
      name: 'istiod',
      status: Status.NotFound,
      is_core: true
    },
    {
      cluster: CLUSTER_DEFAULT,
      name: 'istio-egressgateway',
      status: Status.Unhealthy,
      is_core: true
    }
  ];

  const wrapper = shallow(<IstioStatusList status={components} cluster={'Kubernetes'} />);

  expect(shallowToJson(wrapper)).toBeDefined();
  expect(shallowToJson(wrapper)).toMatchSnapshot();
});
