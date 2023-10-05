import { findChildren, findParent, getWorkloadFromSpan, searchParentWorkload } from '../TracingHelper';
import { Span, KeyValuePair, SpanData } from 'types/TracingInfo';
import { transformTraceData } from '../TraceTransform';

describe('TracingHelper', () => {
  it('should get workload from span', () => {
    const span = {
      tags: [
        { key: 'node_id', value: 'sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local' }
      ],
      process: {
        serviceName: 'svc.default',
        tags: [{ key: 'any', value: 'any' }]
      }
    } as Span;
    const wkdNs = getWorkloadFromSpan(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('ai-locals');
    expect(wkdNs!.pod).toEqual('ai-locals-6d8996bff-ztg6z');

    span.tags = [{ key: 'node_id', value: 'not going to work' } as KeyValuePair];
    const wkdNs3 = getWorkloadFromSpan(span);
    expect(wkdNs3).toBeUndefined();

    span.tags = [{ key: '-', value: 'not going to work' } as KeyValuePair];
    const wkdNs4 = getWorkloadFromSpan(span);
    expect(wkdNs4).toBeUndefined();
  });

  it('should get replicaset from span', () => {
    const span = {
      tags: [
        { key: 'node_id', value: 'sidecar~172.17.0.20~kiali-traffic-generator-wqq8f.default~default.svc.cluster.local' }
      ],
      process: {
        serviceName: 'svc.default',
        tags: [{ key: 'any', value: 'any' }]
      }
    } as Span;
    const wkdNs = getWorkloadFromSpan(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('kiali-traffic-generator');
    expect(wkdNs!.pod).toEqual('kiali-traffic-generator-wqq8f');
  });

  it('should get workload from span hostname', () => {
    const span = {
      tags: [{ key: '-', value: '-' }],
      process: {
        serviceName: 'svc.default',
        tags: [{ key: 'hostname', value: 'my-pod-4bck2l456-abcde' }]
      }
    } as Span;
    const wkdNs = getWorkloadFromSpan(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('my-pod');
    expect(wkdNs!.pod).toEqual('my-pod-4bck2l456-abcde');
  });

  it('should get replicaset from span hostname', () => {
    const span = {
      tags: [{ key: '-', value: '-' }],
      process: {
        serviceName: 'svc.default',
        tags: [{ key: 'hostname', value: 'kiali-traffic-generator-wqq8f' }]
      }
    } as Span;
    const wkdNs = getWorkloadFromSpan(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('kiali-traffic-generator');
    expect(wkdNs!.pod).toEqual('kiali-traffic-generator-wqq8f');
  });

  it('tests more regex', () => {
    const test = (podName: string, expectedWkd: string, expectedNs: string) => {
      const span = { tags: [{ key: 'node_id', value: `any~any~${podName}~any` }] } as Span;
      const wkdNs = getWorkloadFromSpan(span);
      expect(wkdNs).toBeDefined();
      expect(wkdNs!.namespace).toEqual(expectedNs);
      expect(wkdNs!.workload).toEqual(expectedWkd);
    };
    test('simple-k2l4567xz-89zjb.namespace', 'simple', 'namespace');
    test('abc.def-k2l4567xz-89zjb.ns', 'abc.def', 'ns');
    test('ab-1.2-ef-k2l4567xz-89zjb.n-s-3', 'ab-1.2-ef', 'n-s-3');
    test('my-deployment-sdjvdfvmpk-fg65d.ns', 'my-deployment', 'ns');
    test('my-deployment-s2jvd9vmp8-fg65d.ns', 'my-deployment', 'ns');
  });

  it('should find parent workload', () => {
    const parent = {
      tags: [
        { key: 'node_id', value: 'sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local' }
      ]
    } as Span;
    const span = {
      references: [
        {
          refType: 'CHILD_OF',
          span: parent
        }
      ]
    } as Span;
    const wkdNs = searchParentWorkload(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('ai-locals');
  });

  it('should not find parent workload', () => {
    const parent = {
      tags: [
        { key: 'node_id', value: 'sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local' }
      ]
    } as Span;
    const span = {
      references: [
        {
          refType: 'NOT_MY_PARENT' as any,
          span: parent
        }
      ]
    } as Span;
    const wkdNs = searchParentWorkload(span);
    expect(wkdNs).toBeUndefined();

    const span2 = {} as Span;
    const wkdNs2 = searchParentWorkload(span2);
    expect(wkdNs2).toBeUndefined();
  });
});

describe('Trace find related', () => {
  const trace = transformTraceData({
    traceID: 't-1234',
    processes: { p: { serviceName: 'svc', tags: [] } },
    spans: [
      { spanID: 's-1', operationName: 'op1', startTime: 1, processID: 'p' },
      {
        spanID: 's-2',
        operationName: 'op2',
        startTime: 2,
        processID: 'p',
        references: [{ refType: 'CHILD_OF', spanID: 's-1' }]
      },
      {
        spanID: 's-3',
        operationName: 'op3',
        startTime: 3,
        processID: 'p',
        references: [{ refType: 'CHILD_OF', spanID: 's-1' }]
      },
      {
        spanID: 's-4',
        operationName: 'op4',
        startTime: 4,
        processID: 'p',
        references: [{ refType: 'CHILD_OF', spanID: 's-2' }]
      },
      {
        spanID: 's-5',
        operationName: 'op5',
        startTime: 5,
        processID: 'p',
        references: [{ refType: 'CHILD_OF', spanID: 's-2' }]
      }
    ] as SpanData[]
  })!;
  const s1 = trace.spans.find(s => s.spanID === 's-1')!;
  const s2 = trace.spans.find(s => s.spanID === 's-2')!;
  const s3 = trace.spans.find(s => s.spanID === 's-3')!;
  const s4 = trace.spans.find(s => s.spanID === 's-4')!;
  const s5 = trace.spans.find(s => s.spanID === 's-5')!;

  it('should find parents', () => {
    const [p1, p2, p3, p4, p5] = [findParent(s1), findParent(s2), findParent(s3), findParent(s4), findParent(s5)];
    expect(p1).toBeUndefined();
    expect(p2?.spanID).toEqual('s-1');
    expect(p3?.spanID).toEqual('s-1');
    expect(p4?.spanID).toEqual('s-2');
    expect(p5?.spanID).toEqual('s-2');
  });

  it('should find children', () => {
    const [c1, c2, c3, c4, c5] = [
      findChildren(s1, trace),
      findChildren(s2, trace),
      findChildren(s3, trace),
      findChildren(s4, trace),
      findChildren(s5, trace)
    ];
    expect(c1.map(s => s.spanID)).toEqual(['s-2', 's-3']);
    expect(c2.map(s => s.spanID)).toEqual(['s-4', 's-5']);
    expect(c3.map(s => s.spanID)).toEqual([]);
    expect(c4.map(s => s.spanID)).toEqual([]);
    expect(c5.map(s => s.spanID)).toEqual([]);
  });
});
