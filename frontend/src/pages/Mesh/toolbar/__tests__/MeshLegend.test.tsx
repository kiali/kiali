import * as React from 'react';
import { shallow } from 'enzyme';
import { MeshLegend } from 'pages/Mesh/MeshLegend';

describe('MeshLegend test', () => {
  it('should render legend content and close control', () => {
    const closeLegend = jest.fn();
    const wrapper = shallow(<MeshLegend closeLegend={closeLegend} />);

    expect(wrapper.find('[data-test="graph-legend"]').exists()).toBe(true);
    wrapper.find('button').simulate('click');
    expect(closeLegend).toHaveBeenCalledTimes(1);
  });
});
