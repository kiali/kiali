import * as React from 'react';
import { shallow } from 'enzyme';
import RateIntervalToolbarItem from '../RateIntervalToolbarItem';
import * as RateIntervals from '../../../utils/RateIntervals';

describe('RateIntervalToolbarItem', () => {
  it('renders correctly', () => {
    const wrapper = shallow(<RateIntervalToolbarItem rateIntervalSelected={600} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('MenuItem').length).toBe(RateIntervals.tuples.length);
  });
});
