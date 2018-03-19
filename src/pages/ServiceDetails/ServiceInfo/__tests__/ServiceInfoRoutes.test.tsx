import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoRoutes } from '../index';

const dependencies: Map<string, string[]> = new Map([['v1', ['productpage.istio-system/v1']]]);

describe('#ServiceInfoRoutes render correctly with data', () => {
  it('should render service routes', () => {
    const wrapper = shallow(<ServiceInfoRoutes dependencies={dependencies} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
