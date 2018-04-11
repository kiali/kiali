import * as React from 'react';
import { mount, shallow } from 'enzyme';

import MetricsOptionsBar from '../MetricsOptionsBar';

const optionsChanged = jest.fn();
const lastOptionsChanged = () => {
  return optionsChanged.mock.calls[optionsChanged.mock.calls.length - 1][0];
};

describe('MetricsOptionsBar', () => {
  it('renders initial layout', () => {
    const wrapper = shallow(<MetricsOptionsBar onOptionsChanged={jest.fn()} onPollIntervalChanged={jest.fn()} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('changes trigger parent callback', () => {
    const wrapper = mount(<MetricsOptionsBar onOptionsChanged={optionsChanged} onPollIntervalChanged={jest.fn()} />);
    expect(optionsChanged).toHaveBeenCalledTimes(1);
    const opts = lastOptionsChanged();
    // Step = duration / ticks
    expect(opts).toHaveProperty('duration', MetricsOptionsBar.DefaultDuration);
    expect(opts).toHaveProperty('step', MetricsOptionsBar.DefaultDuration / MetricsOptionsBar.DefaultTicks);
    expect(opts).toHaveProperty('rateInterval', MetricsOptionsBar.DefaultRateInterval);

    let elt = wrapper
      .find('#duration')
      .find('SafeAnchor')
      .first();
    elt.simulate('click');
    expect(optionsChanged).toHaveBeenCalledTimes(2);
    const expectedDuration = MetricsOptionsBar.Durations[0][0];
    expect(lastOptionsChanged()).toHaveProperty('duration', expectedDuration);
    expect(lastOptionsChanged()).toHaveProperty('step', expectedDuration / MetricsOptionsBar.DefaultTicks);

    elt = wrapper
      .find('#ticks')
      .find('SafeAnchor')
      .first();
    elt.simulate('click');
    expect(optionsChanged).toHaveBeenCalledTimes(3);
    expect(lastOptionsChanged()).toHaveProperty('step', expectedDuration / MetricsOptionsBar.Ticks[0]);

    elt = wrapper
      .find('#rateInterval')
      .find('SafeAnchor')
      .last();
    elt.simulate('click');
    expect(optionsChanged).toHaveBeenCalledTimes(4);
    expect(lastOptionsChanged()).toHaveProperty(
      'rateInterval',
      MetricsOptionsBar.RateIntervals[MetricsOptionsBar.RateIntervals.length - 1][0]
    );
  });
});
