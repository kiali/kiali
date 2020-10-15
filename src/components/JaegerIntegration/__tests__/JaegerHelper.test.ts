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
