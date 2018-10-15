import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceErrorRate from '../ServiceErrorRate';
import { RequestHealth } from '../../../types/Health';

describe('ServiceErrorRate', () => {
  it('should render correctly with basic data', () => {
    const reqErr: RequestHealth = {
      errorRatio: 0
    };
    const wrapper = shallow(<ServiceErrorRate requestHealth={reqErr} />);
    expect(wrapper.text()).toBe('Error Rate: 0.00%');
  });
  it('should render correctly with some errors', () => {
    const reqErr: RequestHealth = {
      errorRatio: 0.4
    };
    const wrapper = shallow(<ServiceErrorRate requestHealth={reqErr} />);
    expect(wrapper.text()).toBe('Error Rate: 40.00%');
  });
  it('should render correctly with no data', () => {
    const reqErr: RequestHealth = {
      errorRatio: -1
    };
    const wrapper = shallow(<ServiceErrorRate requestHealth={reqErr} />);
    expect(wrapper.text()).toMatch(/No requests/);
  });
});
