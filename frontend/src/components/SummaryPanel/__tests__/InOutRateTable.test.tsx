import { render, screen } from '@testing-library/react';
import { InOutRateTableGrpc, InOutRateTableHttp } from '../InOutRateTable';

rstest.mock('../RateChart', () => ({
  renderInOutRateChartGrpc: (...args: unknown[]) => (
    <div data-hide-in={String(Boolean(args[4]))} data-test="in-out-grpc-chart" />
  ),
  renderInOutRateChartHttp: (...args: unknown[]) => (
    <div data-hide-in={String(Boolean(args[10]))} data-test="in-out-http-chart" />
  )
}));

describe('InOutRateTable', () => {
  it('hides inbound HTTP data when requested', () => {
    render(
      <InOutRateTableHttp
        hideIn={true}
        inRate={0}
        inRate3xx={0}
        inRate4xx={0}
        inRate5xx={0}
        inRateNR={0}
        outRate={10}
        outRate3xx={1}
        outRate4xx={1}
        outRate5xx={1}
        outRateNR={0}
        title="HTTP Traffic"
      />
    );

    expect(screen.queryByText('In')).not.toBeInTheDocument();
    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByTestId('in-out-http-chart')).toHaveAttribute('data-hide-in', 'true');
  });

  it('shows inbound and outbound gRPC data by default', () => {
    render(
      <InOutRateTableGrpc
        inRate={5}
        inRateGrpcErr={0}
        inRateNR={0}
        outRate={10}
        outRateGrpcErr={0}
        outRateNR={0}
        title="gRPC Traffic"
      />
    );

    expect(screen.getByText('In')).toBeInTheDocument();
    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByTestId('in-out-grpc-chart')).toHaveAttribute('data-hide-in', 'false');
  });
});
