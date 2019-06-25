import * as React from 'react';
import { shallow } from 'enzyme';
import MTLSIcon, { MTLSIconTypes } from '../MTLSIcon';
import { shallowToJson } from 'enzyme-to-json';

const mockIcon = (icon: string) => {
  const component = (
    <MTLSIcon icon={icon} iconClassName={'className'} overlayText={'Overlay Test'} overlayPosition={'left'} />
  );
  return shallow(component);
};

describe('when Icon is LOCK_FULL', () => {
  it('MTLSIcon renders properly', () => {
    const wrapper = mockIcon(MTLSIconTypes.LOCK_FULL);

    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();

    expect(wrapper.name()).toEqual('OverlayTrigger');
    expect(wrapper.props().placement).toEqual('left');

    expect(wrapper.children()).toBeDefined();
    expect(wrapper.children().name()).toEqual('img');
    expect(wrapper.children().prop('className')).toEqual('className');
    expect(wrapper.children().prop('src')).toEqual('mtls-status-full.svg');

    const overlay = wrapper.props().overlay;
    expect(overlay.props.bsClass).toEqual('tooltip');
    expect(overlay.props.placement).toEqual('right');
    expect(overlay.props.children).toContain('Overlay Test');
  });
});

describe('when Icon is LOCK_HOLLOW', () => {
  it('MTLSIcon renders properly', () => {
    const wrapper = mockIcon(MTLSIconTypes.LOCK_HOLLOW);
    expect(wrapper.children().prop('src')).toEqual('mtls-status-partial.svg');
  });
});
