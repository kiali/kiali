import * as React from 'react';
import { shallow } from 'enzyme';

import GraphLegend from '../GraphLegend';

describe('GraphLegend test', () => {
  it('should render correctly', () => {
    const wrapper = shallow(<GraphLegend closeLegend={jest.fn()} isMTLSEnabled={false} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
