import * as React from 'react';
import { MTLSIcon } from '../MTLSIcon';
import { mount } from 'enzyme';
import { mountToJson } from 'enzyme-to-json';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { MTLSIconTypes } from '../NamespaceMTLSStatus';

const mockIcon = (icon: string) => {
  const component = (
    <Provider store={store}>
      <MTLSIcon
        icon={icon}
        iconClassName="className"
        tooltipText="Overlay Test"
        tooltipPosition={TooltipPosition.right}
      />
    </Provider>
  );
  return mount(component);
};

describe('when Icon is LOCK_FULL', () => {
  it('MTLSIcon renders properly', () => {
    const mount = mockIcon(MTLSIconTypes.LOCK_FULL);

    expect(mountToJson(mount)).toBeDefined();
    expect(mountToJson(mount)).toMatchSnapshot();

    const tooltip = mount.find(Tooltip);
    expect(tooltip.exists()).toBeTruthy();
    expect(tooltip.props().position).toEqual('right');
    expect(tooltip.props().content).toEqual('Overlay Test');

    const img = tooltip.find('img');
    expect(img.exists()).toBeTruthy();
    expect(img.props().className).toEqual('className');
    expect(img.props().src).toEqual('mtls-status-full-dark.svg');
  });
});

describe('when Icon is LOCK_HOLLOW', () => {
  it('MTLSIcon renders properly', () => {
    const mount = mockIcon(MTLSIconTypes.LOCK_HOLLOW);
    const img = mount.find('img');
    expect(img.exists()).toBeTruthy();
    expect(img.props().className).toEqual('className');
    expect(img.props().src).toEqual('mtls-status-partial-dark.svg');
  });
});
