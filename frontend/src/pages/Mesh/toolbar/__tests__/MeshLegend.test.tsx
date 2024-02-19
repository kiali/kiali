import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';
import { MeshLegend } from 'pages/Mesh/MeshLegend';

describe('GraphLegend test', () => {
  it('should render correctly', () => {
    const wrapper = shallow(<MeshLegend closeLegend={jest.fn()} />);
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
