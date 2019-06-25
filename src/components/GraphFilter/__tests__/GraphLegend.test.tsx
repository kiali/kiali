import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import GraphLegend from '../GraphLegend';

describe('GraphLegend test', () => {
  it('should render correctly', () => {
    const wrapper = shallow(<GraphLegend closeLegend={jest.fn()} isMTLSEnabled={false} />);
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
