import * as React from 'react';
import { shallow } from 'enzyme';
import RightToolbar from '../RightToolbar';

describe('RightToolbar', () => {
  let wrapper, onGraphClick, onSummaryClick, onMinimapClick, onSubmit;
  beforeEach(() => {
    onGraphClick = jest.fn();
    onMinimapClick = jest.fn();
    onSummaryClick = jest.fn();
    onSubmit = jest.fn();
    const props = {
      disabled: false,
      onSubmit: onSubmit
    };
    wrapper = shallow(<RightToolbar {...props} />);
  });

  it('renders RightToolbar correctly', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  describe('RightToolbar should have buttons with options', () => {
    it('RightToolbar have Search button', () => {
      let buttonProps = wrapper.find({ title: 'Search' }).props();
      expect(buttonProps).toBeDefined();
      expect(buttonProps.onClick).toBeDefined();
      wrapper.setProps({ disabled: true });
      buttonProps = wrapper.find({ title: 'Search' }).props();
      expect(buttonProps.disabled).toBeTruthy();
    });
  });
});
