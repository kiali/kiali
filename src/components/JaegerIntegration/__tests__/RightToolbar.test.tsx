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
});
