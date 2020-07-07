import { buildTags, getWorkloadFromSpan, searchParentWorkload } from '../JaegerHelper';
import { Span } from 'types/JaegerInfo';

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
      ]
    } as Span;
    const wkdNs = getWorkloadFromSpan(span);
    expect(wkdNs).toBeDefined();
    expect(wkdNs!.namespace).toEqual('default');
    expect(wkdNs!.workload).toEqual('ai-locals');

    const span2 = { tags: [{ key: 'node_id', value: 'not going to work' }] } as Span;
    const wkdNs2 = getWorkloadFromSpan(span2);
    expect(wkdNs2).toBeUndefined();

    const span3 = { tags: [{ key: '-', value: 'not going to work' }] } as Span;
    const wkdNs3 = getWorkloadFromSpan(span3);
    expect(wkdNs3).toBeUndefined();
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
