import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceInfoBadge } from '../index';

describe('#ServiceInfoBadge render correctly with data', () => {
  it('should render service badge', () => {
    const wrapper = shallow(
      <ServiceInfoBadge scale={0.8} style="plastic" color="green" leftText="my_key" rightText="my_value" />
    );
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
