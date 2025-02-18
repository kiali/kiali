import * as React from 'react';
import { shallow } from 'enzyme';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatusList } from '../IstioStatusList';
import { shallowToJson } from 'enzyme-to-json';

it('lists all the components grouped', () => {
  const components: ComponentStatus[] = [
    {
      name: 'grafana',
      status: Status.NotFound,
      is_core: false
    },
    {
      name: 'prometheus',
      status: Status.Unhealthy,
      is_core: false
    },
    {
      name: 'istiod',
      status: Status.NotFound,
      is_core: true
    },
    {
      name: 'istio-egressgateway',
      status: Status.Unhealthy,
      is_core: true
    }
  ];

  const wrapper = shallow(<IstioStatusList status={components} cluster={'Kubernetes'} />);

  expect(shallowToJson(wrapper)).toBeDefined();
  expect(shallowToJson(wrapper)).toMatchSnapshot();
});
