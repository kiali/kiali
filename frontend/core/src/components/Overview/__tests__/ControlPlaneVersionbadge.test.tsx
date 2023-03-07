import React from 'react';

import { render } from '@testing-library/react';

import { ControlPlaneVersionBadge } from '../ControlPlaneVersionbadge';
test('Matches the snapshot', () => {
    const { asFragment } = render(<ControlPlaneVersionBadge version={"1.0"} isCanary />);
    expect(asFragment()).toMatchSnapshot();
  });