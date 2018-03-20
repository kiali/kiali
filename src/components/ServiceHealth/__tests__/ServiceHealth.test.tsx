import * as React from 'react';
import { shallow } from 'enzyme';

import ServiceHealth from '../ServiceHealth';

describe('ServiceHealth', () => {
  it('renders chart', () => {
    const wrapper = shallow(<ServiceHealth size={100} health={{ healthyReplicas: 1, totalReplicas: 1 }} />);
    expect(wrapper.find('DonutChart')).toHaveLength(1);
  });

  it('renders no chart while empty', () => {
    const wrapper = shallow(<ServiceHealth size={100} />);
    expect(wrapper.find('DonutChart')).toHaveLength(0);
  });
});
