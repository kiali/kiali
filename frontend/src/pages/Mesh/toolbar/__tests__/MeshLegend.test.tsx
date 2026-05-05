import * as React from 'react';
import { render } from '@testing-library/react';
import { MeshLegend } from 'pages/Mesh/MeshLegend';

describe('GraphLegend test', () => {
  it('should render correctly', () => {
    const { container } = render(<MeshLegend closeLegend={jest.fn()} />);
    expect(container).toBeDefined();
    expect(container).toMatchSnapshot();
  });
});
