import * as React from 'react';
import { render } from '@testing-library/react';

import { GraphLegend } from '../../GraphLegend';

describe('GraphLegend test', () => {
  it('should render correctly', () => {
    const { container } = render(<GraphLegend closeLegend={jest.fn()} />);
    expect(container).toBeDefined();
    expect(container).toMatchSnapshot();
  });
});
