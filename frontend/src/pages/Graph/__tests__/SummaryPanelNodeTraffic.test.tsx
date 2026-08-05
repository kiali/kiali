import { render, screen } from '@testing-library/react';
import { Edge, Node } from '@patternfly/react-topology';
import { DecoratedGraphNodeData, GraphType, NodeType, SummaryPanelPropType, TrafficRate } from 'types/Graph';
import { SummaryPanelNodeTraffic } from '../SummaryPanelNodeTraffic';

rstest.mock('../../../components/SummaryPanel/InOutRateTable', () => ({
  InOutRateTableGrpc: ({ hideIn }: { hideIn?: boolean }) => (
    <div data-hide-in={String(Boolean(hideIn))} data-test="grpc-rate-table" />
  ),
  InOutRateTableHttp: ({ hideIn }: { hideIn?: boolean }) => (
    <div data-hide-in={String(Boolean(hideIn))} data-test="http-rate-table" />
  )
}));

class TestSummaryPanelNodeTraffic extends SummaryPanelNodeTraffic {
  componentDidMount(): void {}

  componentDidUpdate(): void {}
}

const createProps = (
  isRoot: boolean,
  nodeOverrides: Partial<DecoratedGraphNodeData> = {},
  trafficRates: TrafficRate[] = [TrafficRate.HTTP_REQUEST]
): SummaryPanelPropType => {
  const edge = {
    getData: () => ({
      grpc: 10,
      grpcErr: 0,
      grpcNoResponse: 0,
      http: 10,
      http3xx: 0,
      http4xx: 0,
      http5xx: 0,
      httpNoResponse: 0
    })
  } as Edge;
  const node = {
    getData: () => ({
      grpcIn: 0,
      grpcOut: 0,
      httpIn: 0,
      httpOut: 10,
      isRoot,
      nodeType: NodeType.APP,
      tcpIn: 0,
      tcpOut: 0,
      ...nodeOverrides
    }),
    getSourceEdges: () => [edge],
    getTargetEdges: () => []
  } as unknown as Node;

  return {
    data: {
      summaryTarget: node,
      summaryType: 'node'
    },
    duration: 60,
    graphType: GraphType.VERSIONED_APP,
    injectServiceNodes: false,
    kiosk: '',
    namespaces: [],
    queryTime: 0,
    rateInterval: '1m',
    step: 15,
    trafficRates
  };
};

describe('SummaryPanelNodeTraffic', () => {
  const protocols: [string, Partial<DecoratedGraphNodeData>, TrafficRate[], string][] = [
    ['HTTP', { httpOut: 10 }, [TrafficRate.HTTP_REQUEST], 'No HTTP inbound traffic logged.'],
    ['gRPC requests', { grpcOut: 10, httpOut: 0 }, [TrafficRate.GRPC_REQUEST], 'No gRPC inbound traffic logged.'],
    ['gRPC streams', { grpcOut: 10, httpOut: 0 }, [TrafficRate.GRPC_SENT], 'No gRPC inbound traffic logged.'],
    ['TCP', { httpOut: 0, tcpOut: 10 }, [TrafficRate.TCP_SENT], 'No TCP inbound traffic logged.']
  ];

  it.each(protocols)('hides missing inbound %s traffic for root nodes', (_, nodeOverrides, trafficRates, message) => {
    render(<TestSummaryPanelNodeTraffic {...createProps(true, nodeOverrides, trafficRates)} />);

    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it.each(protocols)(
    'shows missing inbound %s traffic for non-root nodes',
    (_, nodeOverrides, trafficRates, message) => {
      render(<TestSummaryPanelNodeTraffic {...createProps(false, nodeOverrides, trafficRates)} />);

      expect(screen.getByText(message)).toBeInTheDocument();
    }
  );

  it('hides inbound rate data for root nodes using request-based protocols', () => {
    const { rerender } = render(<TestSummaryPanelNodeTraffic {...createProps(true)} />);

    expect(screen.getByTestId('http-rate-table')).toHaveAttribute('data-hide-in', 'true');
    rerender(
      <TestSummaryPanelNodeTraffic {...createProps(true, { grpcOut: 10, httpOut: 0 }, [TrafficRate.GRPC_REQUEST])} />
    );
    expect(screen.getByTestId('grpc-rate-table')).toHaveAttribute('data-hide-in', 'true');
  });
});
