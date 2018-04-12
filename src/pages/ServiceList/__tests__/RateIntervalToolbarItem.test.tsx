import * as React from 'react';
import { shallow } from 'enzyme';
import RateIntervalToolbarItem from '../RateIntervalToolbarItem';
import MetricsOptionsBar from '../../../components/MetricsOptions/MetricsOptionsBar';

describe('RateIntervalToolbarItem', () => {
  it('renders correctly', () => {
    const wrapper = shallow(<RateIntervalToolbarItem rateIntervalSelected="10m" />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('MenuItem').length).toBe(MetricsOptionsBar.RateIntervals.length);
  });
});
