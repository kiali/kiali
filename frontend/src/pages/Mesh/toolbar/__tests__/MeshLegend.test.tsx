import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeshLegend } from 'pages/Mesh/MeshLegend';

describe('MeshLegend test', () => {
  it('should render legend content and close control', async () => {
    const closeLegend = rstest.fn();
    render(<MeshLegend closeLegend={closeLegend} />);

    expect(screen.getByTestId('graph-legend')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('Node Shapes')).toBeInTheDocument();
    expect(screen.getByAltText('Infra node')).toBeInTheDocument();
    expect(screen.getByText('Infra node')).toBeInTheDocument();
    expect(screen.getByText('Kiali')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    expect(closeLegend).toHaveBeenCalledTimes(1);
  });
});
