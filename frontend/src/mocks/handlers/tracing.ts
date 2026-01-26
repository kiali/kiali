import { http, HttpResponse } from 'msw';

// Tag interface
interface SpanTag {
  key: string;
  type: string;
  value: string | number;
}

// Span info interface
interface SpanInfo {
  component: string;
  direction: 'inbound' | 'outbound';
  hasError: boolean;
  method: string;
  statusCode: number;
  url: string;
}

// Mock span interface
interface MockSpan {
  app: string;
  cluster: string;
  component: string;
  depth: number;
  duration: number;
  hasChildren: boolean;
  info: SpanInfo;
  logs: unknown[];
  namespace: string;
  operationName: string;
  pod: string;
  process: { serviceName: string; tags: SpanTag[] };
  processID: string;
  references: Array<{ refType: 'CHILD_OF'; span: null; spanID: string; traceID: string }>;
  relativeStartTime: number;
  spanID: string;
  startTime: number;
  tags: SpanTag[];
  traceID: string;
  type: 'envoy';
  warnings: unknown[];
  workload: string;
}

// Mock tracing configuration
const mockTracingInfo = {
  enabled: true,
  integration: true,
  provider: 'jaeger',
  url: 'http://jaeger:16686',
  internalURL: 'http://jaeger.istio-system:16686',
  namespaceSelector: true,
  whiteListIstioSystem: ['jaeger-query', 'istio-ingressgateway']
};

// Helper to generate a random trace ID
const generateTraceId = (): string => {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

// Helper to generate a random span ID
const generateSpanId = (): string => {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

// Helper to create a mock span
const createMockSpan = (
  traceId: string,
  spanId: string,
  operationName: string,
  serviceName: string,
  startTime: number,
  duration: number,
  parentSpanId?: string,
  namespace = 'bookinfo',
  app = 'productpage',
  workload = 'productpage-v1'
): MockSpan => ({
  traceID: traceId,
  spanID: spanId,
  operationName,
  startTime,
  duration,
  logs: [],
  processID: 'p1',
  references: parentSpanId
    ? [{ refType: 'CHILD_OF' as const, traceID: traceId, spanID: parentSpanId, span: null }]
    : [],
  tags: [
    { key: 'component', type: 'string', value: 'proxy' },
    { key: 'istio.mesh_id', type: 'string', value: 'mesh-default' },
    { key: 'istio.namespace', type: 'string', value: namespace },
    {
      key: 'node_id',
      type: 'string',
      value: `sidecar~10.244.0.10~${workload}.${namespace}~${namespace}.svc.cluster.local`
    },
    { key: 'http.method', type: 'string', value: 'GET' },
    { key: 'http.status_code', type: 'int64', value: 200 },
    { key: 'http.url', type: 'string', value: `http://${serviceName}:9080/` },
    { key: 'request_size', type: 'int64', value: 0 },
    { key: 'response_size', type: 'int64', value: 1024 },
    { key: 'response_flags', type: 'string', value: '-' },
    { key: 'upstream_cluster', type: 'string', value: `outbound|9080||${serviceName}.${namespace}.svc.cluster.local` },
    { key: 'span.kind', type: 'string', value: 'client' }
  ],
  warnings: [],
  depth: parentSpanId ? 1 : 0,
  hasChildren: !parentSpanId,
  relativeStartTime: 0,
  process: {
    serviceName: `${serviceName}.${namespace}`,
    tags: [
      { key: 'ip', type: 'string', value: '10.244.0.10' },
      { key: 'jaeger.version', type: 'string', value: 'Go-2.30.0' }
    ]
  },
  // RichSpanData fields
  app,
  cluster: 'cluster-default',
  component: 'proxy',
  namespace,
  workload,
  pod: `${workload}-abc123`,
  type: 'envoy' as const,
  info: {
    hasError: false,
    component: 'proxy',
    direction: parentSpanId ? ('outbound' as const) : ('inbound' as const),
    method: 'GET',
    statusCode: 200,
    url: `http://${serviceName}:9080/`
  }
});

// Define types for mock data
interface MockTrace {
  duration: number;
  endTime: number;
  processes: Record<string, { serviceName: string; tags: SpanTag[] }>;
  services: Array<{ name: string; numberOfSpans: number }>;
  spans: MockSpan[];
  startTime: number;
  traceID: string;
  traceName: string;
}

// Downstream services for different apps
const downstreamServices: Record<string, string[]> = {
  productpage: ['details', 'reviews'],
  reviews: ['ratings'],
  details: [],
  ratings: [],
  travels: ['hotels', 'cars', 'flights'],
  hotels: [],
  cars: [],
  flights: [],
  voyages: ['travels'],
  default: ['details']
};

// HTTP endpoints for variety
const endpoints = ['/', '/api', '/health', '/metrics', '/products', '/reviews', '/ratings', '/details'];

// HTTP methods
const methods = ['GET', 'POST', 'PUT'];

// Status codes with weights (more 200s)
const statusCodes = [200, 200, 200, 200, 200, 200, 200, 201, 204, 400, 404, 500, 503];

// Generate mock traces for a service
const generateMockTraces = (serviceName: string, namespace: string, count = 100): MockTrace[] => {
  const now = Date.now() * 1000; // Convert to microseconds
  const traces: MockTrace[] = [];
  const downstream = downstreamServices[serviceName] || downstreamServices['default'];

  for (let i = 0; i < count; i++) {
    const traceId = generateTraceId();
    const rootSpanId = generateSpanId();
    const childSpanId = generateSpanId();

    // Vary the time - spread across the time range
    const timeOffset =
      i < 20
        ? (i + 1) * 10 * 1000000 // First 20: every 10 seconds
        : i < 50
        ? (i - 19) * 30 * 1000000 // Next 30: every 30 seconds
        : (i - 49) * 60 * 1000000; // Rest: every minute

    const traceStartTime = now - timeOffset;

    // Vary duration - some fast, some slow
    const baseDuration = 20000 + Math.floor(Math.random() * 30000); // 20-50ms base
    const isSlowTrace = Math.random() < 0.2; // 20% chance of slow trace
    const rootDuration = isSlowTrace ? baseDuration * 5 : baseDuration;

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];
    const hasError = statusCode >= 400;

    // Create spans for this trace
    const spans: ReturnType<typeof createMockSpan>[] = [
      // Root span - ingress gateway
      createMockSpan(
        traceId,
        rootSpanId,
        `${serviceName}.${namespace}.svc.cluster.local:9080${endpoint}`,
        'istio-ingressgateway',
        traceStartTime,
        rootDuration,
        undefined,
        'istio-system',
        'istio-ingressgateway',
        'istio-ingressgateway'
      ),
      // Child span - main service
      createMockSpan(
        traceId,
        childSpanId,
        `${serviceName}.${namespace}.svc.cluster.local:9080${endpoint}`,
        serviceName,
        traceStartTime + 2000,
        rootDuration - 4000,
        rootSpanId,
        namespace,
        serviceName,
        `${serviceName}-v1`
      )
    ];

    // Update tags for variety
    spans[0].tags = spans[0].tags.map(tag => {
      if (tag.key === 'http.method') return { ...tag, value: method };
      if (tag.key === 'http.status_code') return { ...tag, value: statusCode };
      if (tag.key === 'http.url') return { ...tag, value: `http://${serviceName}:9080${endpoint}` };
      return tag;
    });
    spans[0].info = { ...spans[0].info, hasError, method, statusCode };

    spans[1].tags = spans[1].tags.map(tag => {
      if (tag.key === 'http.method') return { ...tag, value: method };
      if (tag.key === 'http.status_code') return { ...tag, value: statusCode };
      if (tag.key === 'http.url') return { ...tag, value: `http://${serviceName}:9080${endpoint}` };
      return tag;
    });
    spans[1].info = { ...spans[1].info, hasError, method, statusCode };

    const services: Array<{ name: string; numberOfSpans: number }> = [
      { name: `istio-ingressgateway.istio-system`, numberOfSpans: 1 },
      { name: `${serviceName}.${namespace}`, numberOfSpans: 1 }
    ];

    // Add downstream service spans
    downstream.forEach((ds, idx) => {
      const dsSpanId = generateSpanId();
      const dsStartTime = traceStartTime + 5000 + idx * 3000;
      const dsDuration = Math.floor((rootDuration - 10000) / (downstream.length + 1));

      spans.push(
        createMockSpan(
          traceId,
          dsSpanId,
          `${ds}.${namespace}.svc.cluster.local:9080/`,
          ds,
          dsStartTime,
          dsDuration,
          childSpanId,
          namespace,
          ds,
          `${ds}-v1`
        )
      );

      services.push({ name: `${ds}.${namespace}`, numberOfSpans: 1 });
    });

    traces.push({
      traceID: traceId,
      spans,
      processes: {
        p1: {
          serviceName: `${serviceName}.${namespace}`,
          tags: [
            { key: 'ip', type: 'string', value: `10.244.0.${10 + i}` },
            { key: 'jaeger.version', type: 'string', value: 'Go-2.30.0' }
          ]
        }
      },
      duration: rootDuration,
      startTime: traceStartTime,
      endTime: traceStartTime + rootDuration,
      services,
      traceName: `istio-ingressgateway.istio-system: ${serviceName}.${namespace}.svc.cluster.local:9080${endpoint}`
    });
  }

  return traces;
};

// Generate mock spans (flat list for metrics overlay)
const generateMockSpans = (serviceName: string, namespace: string, count = 200): MockSpan[] => {
  const now = Date.now() * 1000;
  const spans: MockSpan[] = [];

  for (let i = 0; i < count; i++) {
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    // Spread spans across the time range (last ~30 minutes)
    const timeOffset = i * 10 * 1000000; // Each span 10 seconds apart
    const startTime = now - timeOffset;

    // Vary duration
    const baseDuration = 5000 + Math.floor(Math.random() * 20000); // 5-25ms base
    const isSlowSpan = Math.random() < 0.1; // 10% slow spans
    const duration = isSlowSpan ? baseDuration * 4 : baseDuration;

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];

    const span = createMockSpan(
      traceId,
      spanId,
      `${serviceName}.${namespace}.svc.cluster.local:9080${endpoint}`,
      serviceName,
      startTime,
      duration,
      undefined,
      namespace,
      serviceName,
      `${serviceName}-v1`
    );

    // Update tags for variety
    span.tags = span.tags.map(tag => {
      if (tag.key === 'http.method') return { ...tag, value: method };
      if (tag.key === 'http.status_code') return { ...tag, value: statusCode };
      if (tag.key === 'http.url') return { ...tag, value: `http://${serviceName}:9080${endpoint}` };
      return tag;
    });
    span.info = { ...span.info, hasError: statusCode >= 400, method, statusCode };

    spans.push(span);
  }

  return spans;
};

export const tracingHandlers = [
  // Tracing configuration
  http.get('*/api/tracing', () => {
    return HttpResponse.json(mockTracingInfo);
  }),

  // App traces
  http.get('*/api/namespaces/:namespace/apps/:app/traces', ({ params }) => {
    const { namespace, app } = params;
    const traces = generateMockTraces(app as string, namespace as string);

    return HttpResponse.json({
      data: traces,
      errors: [],
      tracingServiceName: `${app}.${namespace}`
    });
  }),

  // Service traces
  http.get('*/api/namespaces/:namespace/services/:service/traces', ({ params }) => {
    const { namespace, service } = params;
    const traces = generateMockTraces(service as string, namespace as string);

    return HttpResponse.json({
      data: traces,
      errors: [],
      tracingServiceName: `${service}.${namespace}`
    });
  }),

  // Workload traces
  http.get('*/api/namespaces/:namespace/workloads/:workload/traces', ({ params }) => {
    const { namespace, workload } = params;
    const serviceName = (workload as string).replace(/-v\d+$/, '');
    const traces = generateMockTraces(serviceName, namespace as string);

    return HttpResponse.json({
      data: traces,
      errors: [],
      tracingServiceName: `${serviceName}.${namespace}`
    });
  }),

  // App spans
  http.get('*/api/namespaces/:namespace/apps/:app/spans', ({ params }) => {
    const { namespace, app } = params;
    const spans = generateMockSpans(app as string, namespace as string);

    return HttpResponse.json(spans);
  }),

  // Service spans
  http.get('*/api/namespaces/:namespace/services/:service/spans', ({ params }) => {
    const { namespace, service } = params;
    const spans = generateMockSpans(service as string, namespace as string);

    return HttpResponse.json(spans);
  }),

  // Workload spans
  http.get('*/api/namespaces/:namespace/workloads/:workload/spans', ({ params }) => {
    const { namespace, workload } = params;
    const serviceName = (workload as string).replace(/-v\d+$/, '');
    const spans = generateMockSpans(serviceName, namespace as string);

    return HttpResponse.json(spans);
  }),

  // Error traces count
  http.get('*/api/namespaces/:namespace/services/:service/errortraces', () => {
    return HttpResponse.json(2); // Return a small number of error traces
  }),

  // Single trace by ID
  http.get('*/api/traces/:traceId', ({ params }) => {
    const { traceId } = params;
    const traces = generateMockTraces('productpage', 'bookinfo', 1);
    const trace = traces[0];
    trace.traceID = traceId as string;

    return HttpResponse.json({
      data: trace,
      errors: []
    });
  })
];
