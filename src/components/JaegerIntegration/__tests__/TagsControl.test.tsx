import * as React from 'react';
import { shallow } from 'enzyme';
import { TagsControl } from '../TagsControl';
import { shallowToJson } from 'enzyme-to-json';

describe('TagsControls', () => {
  let wrapper, onChangeMock;
  beforeEach(() => {
    onChangeMock = jest.fn();
    wrapper = shallow(<TagsControl onChange={onChangeMock} disable={false} tags={''} />);
  });

  it('renders TagsControl correctly', () => {
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
