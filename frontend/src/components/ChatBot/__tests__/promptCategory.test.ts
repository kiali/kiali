import { derivePromptCategory } from '../promptCategory';

describe('derivePromptCategory', () => {
  it('returns list categories for top-level pages', () => {
    expect(derivePromptCategory('/services')).toBe('services');
    expect(derivePromptCategory('/applications')).toBe('applications');
    expect(derivePromptCategory('/workloads')).toBe('workloads');
    expect(derivePromptCategory('/istio')).toBe('istio');
    expect(derivePromptCategory('/namespaces')).toBe('namespaces');
  });

  it('returns detail categories for namespace-scoped detail pages', () => {
    expect(derivePromptCategory('/namespaces/bookinfo')).toBe('namespace-details');
    expect(derivePromptCategory('/namespaces/bookinfo/services/reviews')).toBe('service-details');
    expect(derivePromptCategory('/namespaces/bookinfo/applications/details-v1')).toBe('application-details');
    expect(derivePromptCategory('/namespaces/bookinfo/workloads/reviews-v1')).toBe('workload-details');
    expect(derivePromptCategory('/namespaces/bookinfo/istio/networking.istio.io/v1beta1/virtualservices/reviews')).toBe(
      'istio-details'
    );
  });

  it('keeps graph node routes under the graph category', () => {
    expect(derivePromptCategory('/graph/node/namespaces/bookinfo/services/reviews')).toBe('graph');
  });

  it('falls back to overview for empty paths', () => {
    expect(derivePromptCategory('/')).toBe('overview');
  });
});
