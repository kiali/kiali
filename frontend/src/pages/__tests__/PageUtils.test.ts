import {
  buildMetadataPatch,
  buildWorkloadAnnotationsPatch,
  buildWorkloadMetadataPatch,
  getWorkloadAnnotations,
  LAST_APPLIED_ANNOTATION,
  preserveHiddenAnnotations,
  navigateToFilteredList
} from '../PageUtils';

const mockResetFilters = rstest.fn();
const mockNavigate = rstest.fn();

rstest.mock('../../components/Filters/StatefulFilters', () => ({
  FilterSelected: { resetFilters: (...args: unknown[]) => mockResetFilters(...args) }
}));

rstest.mock('../../app/History', () => ({
  URLParam: { NAMESPACES: 'namespaces' },
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) }
}));

describe('buildMetadataPatch', () => {
  it('adds new keys', () => {
    const original = { app: 'ratings' };
    const updated = { app: 'ratings', version: 'v2' };
    const result = JSON.parse(buildMetadataPatch('labels', original, updated));
    expect(result).toEqual({
      metadata: { labels: { app: 'ratings', version: 'v2' } }
    });
  });

  it('changes existing keys', () => {
    const original = { app: 'ratings', version: 'v1' };
    const updated = { app: 'ratings', version: 'v2' };
    const result = JSON.parse(buildMetadataPatch('labels', original, updated));
    expect(result).toEqual({
      metadata: { labels: { app: 'ratings', version: 'v2' } }
    });
  });

  it('removes keys by setting them to null', () => {
    const original = { app: 'ratings', version: 'v1' };
    const updated = { app: 'ratings' };
    const result = JSON.parse(buildMetadataPatch('labels', original, updated));
    expect(result).toEqual({
      metadata: { labels: { app: 'ratings', version: null } }
    });
  });

  it('handles simultaneous add, change, and remove', () => {
    const original = { app: 'ratings', version: 'v1', env: 'prod' };
    const updated = { app: 'ratings', version: 'v2', tier: 'frontend' };
    const result = JSON.parse(buildMetadataPatch('labels', original, updated));
    expect(result).toEqual({
      metadata: { labels: { app: 'ratings', version: 'v2', tier: 'frontend', env: null } }
    });
  });

  it('works with annotations field', () => {
    const original = { 'kubectl.kubernetes.io/restartedAt': '2024-01-01' };
    const updated = { 'kubectl.kubernetes.io/restartedAt': '2024-06-01', note: 'updated' };
    const result = JSON.parse(buildMetadataPatch('annotations', original, updated));
    expect(result).toEqual({
      metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': '2024-06-01', note: 'updated' } }
    });
  });

  it('removes all keys when updated is empty', () => {
    const original = { app: 'ratings', version: 'v1' };
    const updated = {};
    const result = JSON.parse(buildMetadataPatch('labels', original, updated));
    expect(result).toEqual({
      metadata: { labels: { app: null, version: null } }
    });
  });

  it('handles empty original and empty updated', () => {
    const result = JSON.parse(buildMetadataPatch('labels', {}, {}));
    expect(result).toEqual({
      metadata: { labels: {} }
    });
  });

  it('preserves empty string values in the patch', () => {
    const original = { app: 'ratings' };
    const updated = { app: 'ratings', enabled: '' };
    const result = JSON.parse(buildMetadataPatch('annotations', original, updated));
    expect(result).toEqual({
      metadata: { annotations: { app: 'ratings', enabled: '' } }
    });
  });
});

describe('preserveHiddenAnnotations', () => {
  it('re-attaches last-applied-configuration on save', () => {
    const original = {
      [LAST_APPLIED_ANNOTATION]: '{"apiVersion":"v1"}',
      note: 'old'
    };
    const updated = preserveHiddenAnnotations(original, { note: 'new' });
    expect(updated).toEqual({
      [LAST_APPLIED_ANNOTATION]: '{"apiVersion":"v1"}',
      note: 'new'
    });
  });
});

describe('getWorkloadAnnotations', () => {
  it('merges controller and template annotations for templated workloads', () => {
    const annotations = getWorkloadAnnotations({
      annotations: { 'deployment.kubernetes.io/revision': '1' },
      gvk: { Kind: 'Deployment' },
      templateAnnotations: { 'proxy.istio.io/config': 'tracing: {}' }
    });
    expect(annotations).toEqual({
      'deployment.kubernetes.io/revision': '1',
      'proxy.istio.io/config': 'tracing: {}'
    });
  });

  it('prefers template values when the same key exists on controller and template', () => {
    const annotations = getWorkloadAnnotations({
      annotations: { note: 'controller' },
      gvk: { Kind: 'Deployment' },
      templateAnnotations: { note: 'template' }
    });
    expect(annotations).toEqual({ note: 'template' });
  });

  it('filters last-applied-configuration from display', () => {
    const annotations = getWorkloadAnnotations({
      annotations: {
        [LAST_APPLIED_ANNOTATION]: '{"apiVersion":"apps/v1"}',
        'deployment.kubernetes.io/revision': '1'
      },
      gvk: { Kind: 'Deployment' },
      templateAnnotations: { 'proxy.istio.io/config': 'tracing: {}' }
    });
    expect(annotations).toEqual({
      'deployment.kubernetes.io/revision': '1',
      'proxy.istio.io/config': 'tracing: {}'
    });
  });

  it('falls back to controller annotations when template annotations are empty', () => {
    const annotations = getWorkloadAnnotations({
      annotations: { note: 'controller-level' },
      gvk: { Kind: 'Deployment' },
      templateAnnotations: {}
    });
    expect(annotations).toEqual({ note: 'controller-level' });
  });

  it('returns workload annotations for non-templated kinds', () => {
    const annotations = getWorkloadAnnotations({
      annotations: { note: 'pod-level' },
      gvk: { Kind: 'Pod' },
      templateAnnotations: { ignored: 'value' }
    });
    expect(annotations).toEqual({ note: 'pod-level' });
  });
});

describe('buildWorkloadAnnotationsPatch', () => {
  const deployment = {
    annotations: { 'deployment.kubernetes.io/revision': '1' },
    gvk: { Kind: 'Deployment' },
    templateAnnotations: { 'proxy.istio.io/config': 'tracing: {}' }
  };

  it('patches only the pod template when editing template annotations', () => {
    const result = JSON.parse(
      buildWorkloadAnnotationsPatch(deployment, {
        'deployment.kubernetes.io/revision': '1',
        'proxy.istio.io/config': 'tracing: { sampling: 100 }'
      })
    );
    expect(result).toEqual({
      spec: {
        template: {
          metadata: {
            annotations: { 'proxy.istio.io/config': 'tracing: { sampling: 100 }' }
          }
        }
      }
    });
  });

  it('patches only controller metadata when editing controller-only annotations', () => {
    const result = JSON.parse(
      buildWorkloadAnnotationsPatch(deployment, {
        'deployment.kubernetes.io/revision': '2',
        'proxy.istio.io/config': 'tracing: {}'
      })
    );
    expect(result).toEqual({
      metadata: { annotations: { 'deployment.kubernetes.io/revision': '2' } }
    });
  });

  it('routes new annotations to the pod template', () => {
    const result = JSON.parse(
      buildWorkloadAnnotationsPatch(deployment, {
        'deployment.kubernetes.io/revision': '1',
        'proxy.istio.io/config': 'tracing: {}',
        note: 'demo'
      })
    );
    expect(result).toEqual({
      spec: { template: { metadata: { annotations: { note: 'demo' } } } }
    });
  });

  it('removes deleted template annotations without touching controller metadata', () => {
    const result = JSON.parse(
      buildWorkloadAnnotationsPatch(deployment, {
        'deployment.kubernetes.io/revision': '1'
      })
    );
    expect(result).toEqual({
      spec: { template: { metadata: { annotations: { 'proxy.istio.io/config': null } } } }
    });
  });

  it('preserves empty string values in the patch', () => {
    const result = JSON.parse(
      buildWorkloadAnnotationsPatch(deployment, {
        'deployment.kubernetes.io/revision': '1',
        'proxy.istio.io/config': 'tracing: {}',
        'sidecar.istio.io/inject': ''
      })
    );
    expect(result).toEqual({
      spec: { template: { metadata: { annotations: { 'sidecar.istio.io/inject': '' } } } }
    });
  });

  it('returns empty object when nothing changed', () => {
    const result = buildWorkloadAnnotationsPatch(deployment, {
      'deployment.kubernetes.io/revision': '1',
      'proxy.istio.io/config': 'tracing: {}'
    });
    expect(result).toBe('{}');
  });
});

describe('buildWorkloadMetadataPatch', () => {
  describe('templated workload kinds', () => {
    const templatedKinds = [
      'Deployment',
      'ReplicaSet',
      'ReplicationController',
      'DeploymentConfig',
      'StatefulSet',
      'DaemonSet'
    ];

    templatedKinds.forEach(kind => {
      it(`patches both metadata and spec.template.metadata for ${kind}`, () => {
        const original = { app: 'ratings' };
        const updated = { app: 'ratings', version: 'v2' };
        const result = JSON.parse(buildWorkloadMetadataPatch('labels', original, updated, kind));
        expect(result).toEqual({
          metadata: { labels: { app: 'ratings', version: 'v2' } },
          spec: { template: { metadata: { labels: { app: 'ratings', version: 'v2' } } } }
        });
      });
    });

    it('includes null deletions in both locations', () => {
      const original = { app: 'ratings', version: 'v1' };
      const updated = { app: 'ratings' };
      const result = JSON.parse(buildWorkloadMetadataPatch('labels', original, updated, 'Deployment'));
      expect(result).toEqual({
        metadata: { labels: { app: 'ratings', version: null } },
        spec: { template: { metadata: { labels: { app: 'ratings', version: null } } } }
      });
    });

    it('works with annotations for templated kinds', () => {
      const original = { note: 'old' };
      const updated = { note: 'new', extra: 'value' };
      const result = JSON.parse(buildWorkloadMetadataPatch('annotations', original, updated, 'StatefulSet'));
      expect(result).toEqual({
        metadata: { annotations: { note: 'new', extra: 'value' } },
        spec: { template: { metadata: { annotations: { note: 'new', extra: 'value' } } } }
      });
    });
  });

  describe('non-templated workload kinds', () => {
    const nonTemplatedKinds = ['Pod', 'Job', 'CronJob'];

    nonTemplatedKinds.forEach(kind => {
      it(`patches only metadata for ${kind}`, () => {
        const original = { app: 'ratings' };
        const updated = { app: 'ratings', version: 'v2' };
        const result = JSON.parse(buildWorkloadMetadataPatch('labels', original, updated, kind));
        expect(result).toEqual({
          metadata: { labels: { app: 'ratings', version: 'v2' } }
        });
        expect(result.spec).toBeUndefined();
      });
    });

    it('includes null deletions only in metadata', () => {
      const original = { app: 'ratings', version: 'v1' };
      const updated = { app: 'ratings' };
      const result = JSON.parse(buildWorkloadMetadataPatch('labels', original, updated, 'Pod'));
      expect(result).toEqual({
        metadata: { labels: { app: 'ratings', version: null } }
      });
      expect(result.spec).toBeUndefined();
    });
  });
});

describe('navigateToFilteredList', () => {
  beforeEach(() => {
    mockResetFilters.mockClear();
    mockNavigate.mockClear();
  });

  it('resets filters and navigates with label param', () => {
    navigateToFilteredList('namespaces', 'app', 'bookinfo');
    expect(mockResetFilters).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/namespaces?label=app%3Dbookinfo');
  });

  it('includes namespace param when provided', () => {
    navigateToFilteredList('workloads', 'version', 'v1', 'bookinfo');
    expect(mockNavigate).toHaveBeenCalledWith('/workloads?namespaces=bookinfo&label=version%3Dv1');
  });

  it('uses custom labelParam when provided', () => {
    navigateToFilteredList('namespaces', 'istio.io/rev', 'default', undefined, 'namespaceLabel');
    expect(mockNavigate).toHaveBeenCalledWith('/namespaces?namespaceLabel=istio.io%2Frev%3Ddefault');
  });

  it('omits namespace param when undefined', () => {
    navigateToFilteredList('services', 'env', 'prod');
    const url: string = mockNavigate.mock.calls[0][0];
    expect(url).not.toContain('namespaces=');
  });
});
