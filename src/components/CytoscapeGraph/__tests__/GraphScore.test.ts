import {
  NodeType,
  DecoratedGraphElements,
  DecoratedGraphNodeData,
  DecoratedGraphEdgeData,
  DecoratedGraphNodeWrapper,
  DecoratedGraphEdgeWrapper
} from '../../../types/Graph';
import { KialiIcon } from 'config/KialiIcon';
import { ScoringCriteria, scoreNodes } from '../GraphScore';

const findById = (id: string) => (node: DecoratedGraphNodeWrapper) => node.data.id === id;

describe('scoreNodes', () => {
  let nodeData: DecoratedGraphNodeData;
  let edgeData: DecoratedGraphEdgeData;

  beforeEach(() => {
    nodeData = {
      id: 'source',
      nodeType: NodeType.APP,
      cluster: 'any',
      namespace: 'any',
      grpcIn: 0,
      grpcInErr: 0,
      grpcInNoResponse: 0,
      grpcOut: 0,
      health: {
        health: {
          items: []
        },
        getGlobalStatus: () => ({
          name: 'any',
          color: 'any',
          priority: 1,
          icon: KialiIcon['warning'],
          class: 'any'
        }),
        getStatusConfig: () => undefined,
        getTrafficStatus: () => undefined,
        getWorkloadStatus: () => undefined
      },
      healthStatus: 'any',
      httpIn: 0,
      httpIn3xx: 0,
      httpIn4xx: 0,
      httpIn5xx: 0,
      httpInNoResponse: 0,
      httpOut: 0,
      tcpIn: 0,
      tcpOut: 0,

      traffic: {} as never
    };
    edgeData = {
      id: 'any',
      source: 'any',
      target: 'any',
      grpc: 0,
      grpcErr: 0,
      grpcNoResponse: 0,
      grpcPercentErr: 0,
      grpcPercentReq: 0,
      http: 0,
      http3xx: 0,
      http4xx: 0,
      http5xx: 0,
      httpNoResponse: 0,
      httpPercentErr: 0,
      httpPercentReq: 0,
      protocol: 'tcp',
      responses: {},
      tcp: 0,
      isMTLS: 0,
      responseTime: 0,
      throughput: 0
    };
  });

  it('scores inbound edges', () => {
    const input: DecoratedGraphElements = {
      nodes: [
        {
          data: { ...nodeData, id: 'source' }
        },
        {
          data: { ...nodeData, id: 'target' }
        }
      ],
      edges: [
        {
          data: { ...edgeData, protocol: 'tcp', id: 'target1', source: 'source', target: 'target' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'target2', source: 'source', target: 'target' }
        }
      ]
    };
    const scoredNodes = scoreNodes(input, ScoringCriteria.InboundEdges);

    const source = scoredNodes.nodes?.find(findById('source'))!;
    const target = scoredNodes.nodes?.find(findById('target'))!;

    expect(target.data.score).toEqual(1);
    expect(target.data.rank).toEqual(1);

    expect(source.data.score).toBeUndefined();
    expect(source.data.rank).toBeUndefined();
  });

  it('scores outbound edges', () => {
    const input: DecoratedGraphElements = {
      nodes: [
        {
          data: { ...nodeData, id: 'source' }
        },
        {
          data: { ...nodeData, id: 'target' }
        }
      ],
      edges: [
        {
          data: { ...edgeData, protocol: 'tcp', id: 'target1', source: 'source', target: 'target' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'target2', source: 'source', target: 'target' }
        }
      ]
    };
    const scoredNodes = scoreNodes(input, ScoringCriteria.OutboundEdges);

    const source = scoredNodes.nodes?.find(findById('source'))!;
    const target = scoredNodes.nodes?.find(findById('target'))!;

    expect(source.data.score).toEqual(1);
    expect(source.data.rank).toEqual(1);

    expect(target.data.score).toBeUndefined();
    expect(target.data.rank).toBeUndefined();
  });

  it('scores multiple criteria', () => {
    const input: DecoratedGraphElements = {
      nodes: [
        {
          data: { ...nodeData, id: 'source' }
        },
        {
          data: { ...nodeData, id: 'target' }
        }
      ],
      edges: [
        {
          data: { ...edgeData, protocol: 'tcp', id: 'target1', source: 'source', target: 'target' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'target2', source: 'source', target: 'target' }
        }
      ]
    };
    const scoredNodes = scoreNodes(input, ScoringCriteria.OutboundEdges, ScoringCriteria.InboundEdges);

    const source = scoredNodes.nodes?.find(findById('source'))!;
    const target = scoredNodes.nodes?.find(findById('target'))!;

    expect(source.data.score).toEqual(1);
    expect(source.data.rank).toEqual(1);

    expect(target.data.score).toEqual(1);
    expect(target.data.rank).toEqual(1);
  });

  it('scores inbound edges with multiple targets', () => {
    const input: DecoratedGraphElements = {
      nodes: [
        {
          data: { ...nodeData, id: 'source' }
        },
        {
          data: { ...nodeData, id: 'target1' }
        },
        {
          data: { ...nodeData, id: 'target2' }
        }
      ],
      edges: [
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge1', source: 'source', target: 'target1' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge2', source: 'source', target: 'target2' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge3', source: 'source', target: 'target2' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge4', source: 'source', target: 'target2' }
        }
      ]
    };
    const scoredNodes = scoreNodes(input, ScoringCriteria.InboundEdges);

    const target2 = scoredNodes.nodes?.find(findById('target2'))!;
    const target1 = scoredNodes.nodes?.find(findById('target1'))!;
    const source = scoredNodes.nodes?.find(findById('source'))!;

    expect(target2.data.score).toBeGreaterThan(target1.data.score!);
    expect(target2.data.rank).toEqual(1);

    expect(target1.data.score).toBeDefined();
    expect(target1.data.rank).toEqual(2);

    expect(source.data.score).toBeUndefined();
    expect(source.data.rank).toBeUndefined();
  });

  it('does not score for a graph with no edges', () => {
    const input: DecoratedGraphElements = {
      nodes: [
        {
          data: { ...nodeData, id: 'source' }
        },
        {
          data: { ...nodeData, id: 'target1' }
        },
        {
          data: { ...nodeData, id: 'target2' }
        }
      ],
      edges: []
    };
    const scoredNodes = scoreNodes(input, ScoringCriteria.InboundEdges);

    const target2 = scoredNodes.nodes?.find(findById('target2'))!;
    const target1 = scoredNodes.nodes?.find(findById('target1'))!;
    const source = scoredNodes.nodes?.find(findById('source'))!;

    expect(target2.data.score).toBeUndefined();
    expect(target2.data.rank).toBeUndefined();

    expect(target1.data.score).toBeUndefined();
    expect(target1.data.rank).toBeUndefined();

    expect(source.data.score).toBeUndefined();
    expect(source.data.rank).toBeUndefined();
  });

  it('normalizes scores within 100 when more than 100', () => {
    const elements = (): DecoratedGraphElements => {
      const sourceNodes = Array.from(Array(150).keys()).map(idx => ({
        data: { ...nodeData, id: 'source' + idx }
      }));
      const targetNodes = Array.from(Array(150).keys()).map(idx => ({
        data: { ...nodeData, id: 'target' + idx }
      }));
      let edges: DecoratedGraphEdgeWrapper[] = [];
      for (let i = 0; i < sourceNodes.length; i++) {
        for (let j = i; j >= 0; j--) {
          const edge = {
            data: {
              ...edgeData,
              protocol: 'tcp' as any,
              id: 'edge' + i + j,
              source: 'source' + i,
              target: 'target' + j
            }
          };
          edges.push(edge);
        }
      }

      return {
        nodes: sourceNodes.concat(targetNodes),
        edges: edges
      };
    };

    const input = elements();
    const scoredNodes = scoreNodes(input, ScoringCriteria.InboundEdges);

    const firstTarget = scoredNodes.nodes?.find(findById('target0'))!;
    const lastTarget = scoredNodes.nodes?.find(findById('target149'))!;

    expect(firstTarget.data.rank).toEqual(1);

    expect(lastTarget.data.rank).toEqual(100);
  });

  it('removes old scores when no selection criteria is added', () => {
    const input: DecoratedGraphElements = {
      nodes: [
        {
          data: { ...nodeData, id: 'source', score: 0 }
        },
        {
          data: { ...nodeData, id: 'target1', score: 0.5 }
        },
        {
          data: { ...nodeData, id: 'target2', score: 0.5 }
        }
      ],
      edges: [
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge1', source: 'source', target: 'target1' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge2', source: 'source', target: 'target2' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge3', source: 'source', target: 'target2' }
        },
        {
          data: { ...edgeData, protocol: 'tcp', id: 'edge4', source: 'source', target: 'target2' }
        }
      ]
    };

    expect(
      scoreNodes(input).nodes?.every(node => node.data.score === undefined && node.data.rank === undefined)
    ).toBeTruthy();
  });
});
