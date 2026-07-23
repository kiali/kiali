import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphLegend } from '../../GraphLegend';

describe('GraphLegend test', () => {
  it('should render legend content and close control', async () => {
    const closeLegend = rstest.fn();
    render(<GraphLegend closeLegend={closeLegend} />);

    expect(screen.getByTestId('graph-legend')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('Node Shapes')).toBeInTheDocument();
    expect(screen.getByAltText('App')).toBeInTheDocument();
    expect(screen.getByText('App')).toBeInTheDocument();
    expect(screen.getByText('Edges')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    expect(closeLegend).toHaveBeenCalledTimes(1);
  });
});
