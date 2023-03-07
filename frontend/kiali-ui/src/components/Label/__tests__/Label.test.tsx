import * as React from 'react';
import { shallow } from 'enzyme';
import Label from '../Label';
import { shallowToJson } from 'enzyme-to-json';

const mockBadge = (name = 'my_key', value = 'my_value') => {
  const component = <Label value={value} name={name} />;
  return shallow(component);
};

describe('#Badge render correctly with data', () => {
  it('should render badge', () => {
    const key = 'app';
    const value = 'bookinfo';
    const wrapper = mockBadge(key, value);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    expect(wrapper.name()).toEqual('Label');

    const labelKey = wrapper.find('Label').getElements()[0];

    expect(labelKey.props.children).toEqual(`${key}=${value}`);
  });
});
