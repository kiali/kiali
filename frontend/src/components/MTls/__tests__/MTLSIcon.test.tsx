import * as React from 'react';
import { shallow } from 'enzyme';
import { MTLSIcon, MTLSIconTypes } from '../MTLSIcon';
import { shallowToJson } from 'enzyme-to-json';
import { TooltipPosition } from '@patternfly/react-core';

const mockIcon = (icon: string) => {
  const component = (
    <MTLSIcon
      icon={icon}
      iconClassName="className"
      tooltipText="Overlay Test"
      tooltipPosition={TooltipPosition.right}
    />
  );
  return shallow(component);
};

describe('when Icon is LOCK_FULL', () => {
  it('MTLSIcon renders properly', () => {
    const wrapper = mockIcon(MTLSIconTypes.LOCK_FULL);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    expect(wrapper.name()).toEqual('Tooltip');
    expect(wrapper.props().position).toEqual('right');
    expect(wrapper.props().content).toEqual('Overlay Test');

    expect(wrapper.children()).toBeDefined();
    expect(wrapper.children().name()).toEqual('img');
    expect(wrapper.children().prop('className')).toEqual('className');
    expect(wrapper.children().prop('src')).toEqual('mtls-status-full.svg');
  });
});

describe('when Icon is LOCK_HOLLOW', () => {
  it('MTLSIcon renders properly', () => {
    const wrapper = mockIcon(MTLSIconTypes.LOCK_HOLLOW);
    expect(wrapper.children().prop('src')).toEqual('mtls-status-partial.svg');
  });
});
