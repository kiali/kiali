import * as React from 'react';
import { shallow } from 'enzyme';
import { JaegerToolbar } from '../JaegerToolbar';
import { FormControl } from 'patternfly-react';

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

  describe('Form', () => {
    it('FormControl should be disabled', () => {
      wrapper.find(FormControl).forEach(f => {
        expect(f.props().disabled).toBeFalsy();
      });
      wrapper.setProps({ disabled: true });
      wrapper.find(FormControl).forEach(f => {
        expect(f.props().disabled).toBeTruthy();
      });
    });
  });
});
