import * as React from 'react';
import { render } from '@testing-library/react';
import { MTLSIcon } from '../MTLSIcon';
import { TooltipPosition } from '@patternfly/react-core';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { MTLSIconTypes } from '../MTLSIconTypes';

const renderIcon = (icon: string): ReturnType<typeof render> => {
  return render(
    <Provider store={store}>
      <MTLSIcon
        icon={icon}
        iconClassName="className"
        tooltipText="Overlay Test"
        tooltipPosition={TooltipPosition.right}
      />
    </Provider>
  );
};

describe('when Icon is LOCK_FULL', () => {
  it('MTLSIcon renders properly', () => {
    const { container } = renderIcon(MTLSIconTypes.LOCK_FULL);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('className');
  });
});

describe('when Icon is LOCK_HOLLOW', () => {
  it('MTLSIcon renders properly', () => {
    const { container } = renderIcon(MTLSIconTypes.LOCK_HOLLOW);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('className');
  });
});
