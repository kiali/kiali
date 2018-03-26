import * as React from 'react';
import { shallow } from 'enzyme';
import Badge from '../Badge';

describe('#Badge render correctly with data', () => {
  it('should render badge', () => {
    const wrapper = shallow(<Badge scale={0.8} style="plastic" color="green" leftText="my_key" rightText="my_value" />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
