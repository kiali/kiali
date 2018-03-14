import * as React from 'react';
import { mount, shallow } from 'enzyme';

import MetricsOptionsBar from '../MetricsOptionsBar';

const optionsChanged = jest.fn();
const lastOptionsChanged = () => {
  return optionsChanged.mock.calls[optionsChanged.mock.calls.length - 1][0];
};

describe('MetricsOptionsBar', () => {
  it('renders initial layout', () => {
    const wrapper = shallow(<MetricsOptionsBar onOptionsChanged={jest.fn()} />);
    const eltDuration = wrapper.find('#duration');
    expect(eltDuration.length).toBe(1);
    const eltStep = wrapper.find('#step');
    expect(eltStep.length).toBe(1);
    const eltRateInterval = wrapper.find('#rateInterval');
    expect(eltRateInterval.length).toBe(1);
  });

  it('changes trigger parent callback', () => {
    const wrapper = mount(<MetricsOptionsBar onOptionsChanged={optionsChanged} />);
    expect(optionsChanged).toHaveBeenCalledTimes(1);
    const opts = lastOptionsChanged();
    expect(opts).toHaveProperty('duration', '600');
    expect(opts).toHaveProperty('step', '15');
    expect(opts).toHaveProperty('rateInterval', '1m');

    let elt = wrapper
      .find('#duration')
      .find('SafeAnchor')
      .first();
    elt.simulate('click');
    expect(optionsChanged).toHaveBeenCalledTimes(2);
    expect(lastOptionsChanged()).toHaveProperty('duration', '300');

    elt = wrapper
      .find('#step')
      .find('SafeAnchor')
      .first();
    elt.simulate('click');
    expect(optionsChanged).toHaveBeenCalledTimes(3);
    expect(lastOptionsChanged()).toHaveProperty('step', '1');

    elt = wrapper
      .find('#rateInterval')
      .find('SafeAnchor')
      .last();
    elt.simulate('click');
    expect(optionsChanged).toHaveBeenCalledTimes(4);
    expect(lastOptionsChanged()).toHaveProperty('rateInterval', '30m');
  });
});
