import { buildTags, getWorkloadFromSpan, searchParentWorkload } from '../JaegerHelper';
import { Span, KeyValuePair } from 'types/JaegerInfo';

describe('JaegerHelper', () => {
  it('should build tags', () => {
    expect(buildTags(true, '404')).toEqual('{"error":"true","http.status_code":"404"}');
    expect(buildTags(true, 'none')).toEqual('{"error":"true"}');
    expect(buildTags(false, '500')).toEqual('{"http.status_code":"500"}');
    expect(buildTags(false, 'none')).toEqual('');
  });

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

    span.tags = [{ key: 'node_id', value: 'not going to work' } as KeyValuePair];
    const wkdNs3 = getWorkloadFromSpan(span);
    expect(wkdNs3).toBeUndefined();

    span.tags = [{ key: '-', value: 'not going to work' } as KeyValuePair];
    const wkdNs4 = getWorkloadFromSpan(span);
    expect(wkdNs4).toBeUndefined();
  });

  it('should get workload from span hostname', () => {
    const span = {
      tags: [{ key: '-', value: '-' }],
      process: {
        serviceName: 'svc.default',
        tags: [{ key: 'hostname', value: 'my-pod-123456-abcdef' }]
      }
    } as Span;
    const wkdNs = getWorkloadFromSpan(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('my-pod');
  });

  it('tests more regex', () => {
    const test = (podName: string, expectedWkd: string, expectedNs: string) => {
      const span = { tags: [{ key: 'node_id', value: `any~any~${podName}~any` }] } as Span;
      const wkdNs = getWorkloadFromSpan(span);
      expect(wkdNs).toBeDefined();
      expect(wkdNs!.namespace).toEqual(expectedNs);
      expect(wkdNs!.workload).toEqual(expectedWkd);
    };
    test('simple-1234xy-5678z.namespace', 'simple', 'namespace');
    test('abc.def-1234xy-5678z.ns', 'abc.def', 'ns');
    test('ab-1.2-ef-1234xy-5678z.n-s-3', 'ab-1.2-ef', 'n-s-3');
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
