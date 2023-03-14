import React from 'react';
import { render, screen } from '@testing-library/react';
import enzyme from 'enzyme';

const { shallow } = enzyme;

import { ControlPlaneVersionBadge } from '../ControlPlaneVersionbadge';

const mockControlPlaneVersionBadge = (version: string = "1.0", canary: boolean = true) => {
  return <ControlPlaneVersionBadge version={version} isCanary={canary} />;
};

describe("ControlPlaneVersionBadge", () => {
   test('Renders with correct version', () => {
    render(mockControlPlaneVersionBadge());
    expect(screen.getByText("1.0")).toBeVisible();
    expect(screen.getByText("1.0")).toHaveClass('pf-c-label__content');
  });

  test('Renders with canary', () => {
    const wrapper = shallow(mockControlPlaneVersionBadge())
    expect(wrapper.name()).toEqual('Label');    
    const labelComponent = wrapper.find('Label').getElements()[0];
    expect(labelComponent.props.color).toEqual('blue');
  });

  test('Renders without canary', () => {
    const wrapper = shallow(mockControlPlaneVersionBadge("1.0", false))
    expect(wrapper.name()).toEqual('Label');    
    const labelComponent = wrapper.find('Label').getElements()[0];
    expect(labelComponent.props.color).toEqual('orange');
  });
});

test('Matches the snapshot', () => {
    const { asFragment } = render(<ControlPlaneVersionBadge version={"1.0"} isCanary />);
    expect(asFragment()).toMatchSnapshot();
});