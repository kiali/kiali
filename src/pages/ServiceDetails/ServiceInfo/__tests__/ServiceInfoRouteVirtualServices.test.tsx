import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfoVirtualServices from '../ServiceInfoVirtualServices';
import { Service } from './ServiceMock';
import { shallowToJson } from 'enzyme-to-json';

describe('#ServiceInfoVirtualServices render correctly with data', () => {
  it('should render service virtual services', () => {
    const wrapper = shallow(
      <ServiceInfoVirtualServices service={Service} virtualServices={Service.virtualServices.items} validations={{}} />
    );
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
