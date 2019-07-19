import * as React from 'react';
import { shallow } from 'enzyme';

import { ApiTypeIndicator } from '../ApiTypeIndicator';

describe('ApiTypeIndicator', () => {
  it('renders no image when apiType is not known', () => {
    let wrapper = shallow(<ApiTypeIndicator apiType="unknown" />);
    expect(wrapper.html()).not.toContain('img');
  });

  it('renders image when apiType is known', () => {
    let wrapper = shallow(<ApiTypeIndicator apiType="rest" />);
    expect(wrapper.html()).toContain('img');
  });
});
