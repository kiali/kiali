import * as React from 'react';
import { shallow } from 'enzyme';
import { JaegerToolbar } from '../JaegerToolbar';

describe('LookBack', () => {
  let wrapper, requestSearchURL, updateURL;
  beforeEach(() => {
    requestSearchURL = jest.fn();
    updateURL = jest.fn();
    const props = {
      disableSelector: false,
      tagsValue: '',
      disabled: false,
      limit: 0,
      requestSearchURL: requestSearchURL,
      namespaceSelector: true,
      updateURL: updateURL,
      urlJaeger: '',
      serviceSelected: 'details.bookinfo'
    };
    wrapper = shallow(<JaegerToolbar {...props} />);
  });

  it('renders JaegerToolbar correctly', () => {
    expect(wrapper).toBeDefined();
  });

  it('renders JaegerToolbar correctly without namespace selector', () => {
    wrapper.setProps({ disableSelector: true });
    expect(wrapper).toBeDefined();
  });
});
