import * as React from 'react';
import { shallow, mount } from 'enzyme';

import GraphLegend from '../GraphLegend';

describe('GraphLegend test', () => {
  it('should render correctly', () => {
    const wrapper = shallow(<GraphLegend closeLegend={jest.fn()} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('should have this components', () => {
    const wrapper = mount(<GraphLegend closeLegend={jest.fn()} />);
    expect(wrapper.find('Card').getElements()).toBeDefined();
    expect(wrapper.find('Arrow').getElements().length).toEqual(5);
  });
});
