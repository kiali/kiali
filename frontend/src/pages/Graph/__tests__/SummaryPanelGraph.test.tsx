import { edgesIn } from 'helpers/GraphHelpers';
import { NodeAttr, NodeType } from 'types/Graph';
import { getAccumulatedTrafficRateHttp } from 'utils/TrafficRate';

interface MockNode {
  getData: () => Record<string, any>;
  getId: () => string;
  getSourceEdges: () => MockEdge[];
  getTargetEdges: () => MockEdge[];
}

interface MockEdge {
  getData: () => Record<string, any>;
  getSource: () => MockNode;
  getTarget: () => MockNode;
}

// Mock node data factory
const createMockNode = (data: Record<string, any>): MockNode => ({
  getData: () => data,
  getId: () => data.id,
  getSourceEdges: () => [],
  getTargetEdges: () => []
});

// Mock edge data factory
const createMockEdge = (source: MockNode, target: MockNode, edgeData: Record<string, any> = {}): MockEdge => ({
  getData: () => ({ ...edgeData, source: source.getId(), target: target.getId() }),
  getSource: () => source,
  getTarget: () => target
});

describe('SummaryPanelGraph outbound traffic calculation', () => {
  describe('getAccumulatedTrafficRateHttp', () => {
    it('should return zero rates for empty edges array', () => {
      const result = getAccumulatedTrafficRateHttp([]);
      expect(result.rate).toBe(0);
      expect(result.rate3xx).toBe(0);
      expect(result.rate4xx).toBe(0);
      expect(result.rate5xx).toBe(0);
      expect(result.rateNoResponse).toBe(0);
    });

    it('should accumulate HTTP traffic rates from edges', () => {
      const sourceNode = createMockNode({ id: 'source', namespace: 'bookinfo' });
      const targetNode = createMockNode({ id: 'target', namespace: 'external' });

      const edges = [
        createMockEdge(sourceNode, targetNode, {
          http: 1.5,
          http3xx: 0.1,
          http4xx: 0.2,
          http5xx: 0.05,
          httpNoResponse: 0
        }),
        createMockEdge(sourceNode, targetNode, {
          http: 2.0,
          http3xx: 0,
          http4xx: 0.1,
          http5xx: 0,
          httpNoResponse: 0.01
        })
      ];

      const result = getAccumulatedTrafficRateHttp(edges);
      expect(result.rate).toBe(3.5);
      expect(result.rate3xx).toBe(0.1);
      expect(result.rate4xx).toBeCloseTo(0.3, 5);
      expect(result.rate5xx).toBe(0.05);
      expect(result.rateNoResponse).toBe(0.01);
    });
  });

  describe('outbound edges calculation', () => {
    it('should identify outbound edges from inside to outside namespaces', () => {
      // Setup: Create nodes inside and outside the requested namespace
      const requestedNamespaces = ['bookinfo'];

      // Inside nodes (in bookinfo namespace)
      const productpage = createMockNode({
        id: 'productpage',
        namespace: 'bookinfo',
        nodeType: NodeType.WORKLOAD,
        workload: 'productpage-v1'
      });
      const reviews = createMockNode({
        id: 'reviews',
        namespace: 'bookinfo',
        nodeType: NodeType.WORKLOAD,
        workload: 'reviews-v1'
      });

      // Outside nodes (in different namespaces)
      const externalDb = createMockNode({
        id: 'external-db',
        namespace: 'database',
        nodeType: NodeType.SERVICE,
        service: 'mysql'
      });

      const allNodes = [productpage, reviews, externalDb];

      // Identify inside and outside nodes like in SummaryPanelGraph.tsx
      const insideNodes = allNodes.filter(n => {
        const nodeData = n.getData();
        return requestedNamespaces.includes(nodeData[NodeAttr.namespace]);
      });

      const outsideNodes = allNodes.filter(n => {
        const nodeData = n.getData();
        return !requestedNamespaces.includes(nodeData[NodeAttr.namespace]);
      });

      expect(insideNodes.length).toBe(2);
      expect(outsideNodes.length).toBe(1);
      expect(insideNodes.map(n => n.getData().id)).toContain('productpage');
      expect(insideNodes.map(n => n.getData().id)).toContain('reviews');
      expect(outsideNodes.map(n => n.getData().id)).toContain('external-db');
    });

    it('should correctly calculate outbound traffic when services call external destinations', () => {
      const requestedNamespaces = ['bookinfo'];

      // Inside node
      const reviews = createMockNode({
        id: 'reviews',
        namespace: 'bookinfo',
        nodeType: NodeType.WORKLOAD,
        workload: 'reviews-v1'
      });

      // Outside node (external service)
      const ratingsExternal = createMockNode({
        id: 'ratings-external',
        namespace: 'external-services',
        nodeType: NodeType.SERVICE,
        service: 'ratings-api'
      });

      // Create edge from inside to outside with HTTP traffic
      const outboundEdge = createMockEdge(reviews, ratingsExternal, {
        http: 2.5,
        http3xx: 0,
        http4xx: 0.1,
        http5xx: 0.05,
        httpNoResponse: 0
      });

      // Mock the edge relationships
      (reviews as any).getSourceEdges = () => [outboundEdge];
      (ratingsExternal as any).getTargetEdges = () => [outboundEdge];

      const allNodes = [reviews, ratingsExternal] as any[];

      // Calculate outbound edges using the same logic as SummaryPanelGraph.tsx
      const insideNodes = allNodes.filter(n => requestedNamespaces.includes(n.getData()[NodeAttr.namespace]));
      const outsideNodes = allNodes.filter(n => !requestedNamespaces.includes(n.getData()[NodeAttr.namespace]));

      // edgesIn(outsideNodes, insideNodes) - edges going INTO outside nodes FROM inside nodes
      const outboundEdges = edgesIn(outsideNodes, insideNodes);

      expect(outboundEdges.length).toBe(1);

      const httpOut = getAccumulatedTrafficRateHttp(outboundEdges);
      expect(httpOut.rate).toBe(2.5);
      expect(httpOut.rate4xx).toBe(0.1);
      expect(httpOut.rate5xx).toBe(0.05);
    });

    it('should return zero outbound traffic when all traffic stays within namespace', () => {
      const requestedNamespaces = ['bookinfo'];

      // All nodes inside bookinfo namespace
      const productpage = createMockNode({
        id: 'productpage',
        namespace: 'bookinfo',
        nodeType: NodeType.WORKLOAD
      });
      const reviews = createMockNode({
        id: 'reviews',
        namespace: 'bookinfo',
        nodeType: NodeType.WORKLOAD
      });

      // Internal edge (within namespace)
      const internalEdge = createMockEdge(productpage, reviews, {
        http: 5.0,
        http3xx: 0,
        http4xx: 0,
        http5xx: 0,
        httpNoResponse: 0
      });

      (productpage as any).getSourceEdges = () => [internalEdge];
      (reviews as any).getTargetEdges = () => [internalEdge];

      const allNodes = [productpage, reviews] as any[];

      const outsideNodes = allNodes.filter(n => !requestedNamespaces.includes(n.getData()[NodeAttr.namespace]));
      const insideNodes = allNodes.filter(n => requestedNamespaces.includes(n.getData()[NodeAttr.namespace]));

      // No outside nodes, so no outbound edges
      expect(outsideNodes.length).toBe(0);

      const outboundEdges = edgesIn(outsideNodes, insideNodes);
      expect(outboundEdges.length).toBe(0);

      const httpOut = getAccumulatedTrafficRateHttp(outboundEdges);
      expect(httpOut.rate).toBe(0);
    });

    it('should not count inbound traffic as outbound', () => {
      const requestedNamespaces = ['bookinfo'];

      // Root/external node (outside namespace, traffic source)
      const externalClient = createMockNode({
        id: 'external-client',
        namespace: 'istio-system',
        nodeType: NodeType.UNKNOWN,
        isRoot: true
      });

      // Inside node
      const productpage = createMockNode({
        id: 'productpage',
        namespace: 'bookinfo',
        nodeType: NodeType.WORKLOAD
      });

      // Inbound edge (from outside to inside) - this is INBOUND, not outbound
      const inboundEdge = createMockEdge(externalClient, productpage, {
        http: 10.0,
        http3xx: 0,
        http4xx: 0,
        http5xx: 0,
        httpNoResponse: 0
      });

      (externalClient as any).getSourceEdges = () => [inboundEdge];
      (productpage as any).getTargetEdges = () => [inboundEdge];

      const allNodes = [externalClient, productpage] as any[];

      const outsideNodes = allNodes.filter(n => !requestedNamespaces.includes(n.getData()[NodeAttr.namespace]));
      const insideNodes = allNodes.filter(n => requestedNamespaces.includes(n.getData()[NodeAttr.namespace]));

      // edgesIn(outsideNodes, insideNodes) = edges INTO outside nodes FROM inside nodes
      // The inbound edge goes FROM outside TO inside, so it should NOT be counted
      const outboundEdges = edgesIn(outsideNodes, insideNodes);

      // The edge from externalClient -> productpage should NOT be in outboundEdges
      // because productpage (inside) is the TARGET, not externalClient (outside)
      expect(outboundEdges.length).toBe(0);

      const httpOut = getAccumulatedTrafficRateHttp(outboundEdges);
      expect(httpOut.rate).toBe(0);
    });
  });

  describe('totalEdges calculation', () => {
    it('should pass edges array to getAccumulatedTrafficRateHttp', () => {
      const edges = [
        createMockEdge(createMockNode({ id: 'a', namespace: 'test' }), createMockNode({ id: 'b', namespace: 'test' }), {
          http: 1.0,
          http3xx: 0,
          http4xx: 0,
          http5xx: 0,
          httpNoResponse: 0
        })
      ];

      const correctResult = getAccumulatedTrafficRateHttp(edges);
      expect(correctResult.rate).toBe(1.0);
    });
  });
});
