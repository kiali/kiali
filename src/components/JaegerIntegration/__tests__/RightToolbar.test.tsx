import * as React from 'react';
import { shallow } from 'enzyme';
import RightToolbar from '../RightToolbar';
import { shallowToJson } from 'enzyme-to-json';

describe('RightToolbar', () => {
  let wrapper, onSubmit;
  beforeEach(() => {
    onSubmit = jest.fn();
    const props = {
      disabled: false,
      onSubmit: onSubmit
    };
    wrapper = shallow(<RightToolbar {...props} />);
  });

  it('renders RightToolbar correctly', () => {
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
