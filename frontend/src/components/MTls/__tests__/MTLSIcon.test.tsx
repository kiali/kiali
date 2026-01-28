import * as React from 'react';
import { MTLSIcon } from '../MTLSIcon';
import { mount } from 'enzyme';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { MTLSIconTypes } from '../MTLSIconTypes';

const mockIcon = (icon: string): ReturnType<typeof mount> => {
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

    const tooltip = mount.find(Tooltip);
    expect(tooltip.exists()).toBeTruthy();
    expect(tooltip.props().position).toEqual('right');
    expect(tooltip.props().content).toEqual('Overlay Test');

    const svg = tooltip.find('svg');
    expect(svg.exists()).toBeTruthy();
    expect(svg.props().className).toEqual('className');
  });
});

describe('when Icon is LOCK_HOLLOW', () => {
  it('MTLSIcon renders properly', () => {
    const mount = mockIcon(MTLSIconTypes.LOCK_HOLLOW);
    const svg = mount.find('svg');
    expect(svg.exists()).toBeTruthy();
    expect(svg.props().className).toEqual('className');
  });
});
