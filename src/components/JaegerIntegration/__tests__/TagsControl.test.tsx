import * as React from 'react';
import { shallow } from 'enzyme';
import { TagsControl } from '../TagsControl';

describe('TagsControls', () => {
  let wrapper, onChangeMock;
  beforeEach(() => {
    onChangeMock = jest.fn();
    wrapper = shallow(<TagsControl onChange={onChangeMock} disable={false} tags={''} />);
  });

  it('renders TagsControl correctly', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
