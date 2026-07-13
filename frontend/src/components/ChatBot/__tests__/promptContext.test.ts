let mockIsMultiCluster = false;

rstest.mock('config', () => ({
  get isMultiCluster() {
    return mockIsMultiCluster;
  }
}));

import {
  buildPageContext,
  buildPromptContext,
  buildPromptVariables,
  buildUnhealthyResourcePrompts,
  enrichPromptContext,
  formatHealthContext,
  mergePromptsWithUnhealthy,
  substitutePrompt,
  substitutePrompts,
  substitutePromptVariables
} from '../promptContext';

describe('buildPromptContext', () => {
  it('returns undefined when kind is not provided', () => {
    expect(buildPromptContext(undefined, undefined, undefined, undefined)).toBeUndefined();
  });

  it('builds service detail context', () => {
    expect(buildPromptContext('service', 'details', 'bookinfo', undefined)).toEqual({
      clusterName: undefined,
      isDetailView: true,
      istioType: undefined,
      namespace: 'bookinfo',
      namespaceList: undefined,
      resourceKind: 'service',
      resourceName: 'details'
    });
  });

  it('ignores cluster name in single-cluster environments', () => {
    mockIsMultiCluster = false;
    expect(buildPromptContext('istio', 'reviews', 'bookinfo', 'virtualservices', 'east')).toEqual({
      clusterName: undefined,
      isDetailView: true,
      istioType: 'virtualservices',
      namespace: 'bookinfo',
      namespaceList: undefined,
      resourceKind: 'istio',
      resourceName: 'reviews'
    });
  });
});

describe('enrichPromptContext', () => {
  it('adds active namespaces to list views', () => {
    expect(
      enrichPromptContext(
        {
          isDetailView: false,
          resourceKind: 'services'
        },
        'bookinfo,default'
      )
    ).toEqual({
      isDetailView: false,
      namespaceList: 'bookinfo,default',
      resourceKind: 'services'
    });
  });
});

describe('formatHealthContext', () => {
  it('returns empty string for missing or NA health', () => {
    expect(formatHealthContext()).toBe('');
    expect(formatHealthContext('NA')).toBe('');
  });

  it('formats known health statuses', () => {
    expect(formatHealthContext('Degraded')).toBe(' with current health status Degraded');
  });
});

describe('buildPageContext', () => {
  it('does not append cluster in single-cluster environments', () => {
    mockIsMultiCluster = false;
    expect(buildPageContext('app', 'reviews', 'bookinfo', undefined, 'west')).toBe(
      'User is seeing the information about application reviews of namespace bookinfo'
    );
  });

  it('appends cluster in multi-cluster environments', () => {
    mockIsMultiCluster = true;
    expect(buildPageContext('app', 'reviews', 'bookinfo', undefined, 'west')).toBe(
      'User is seeing the information about application reviews of namespace bookinfo in cluster west'
    );
    mockIsMultiCluster = false;
  });
  it('appends health status on detail views', () => {
    mockIsMultiCluster = false;
    expect(buildPageContext('service', 'details', 'bookinfo', undefined, undefined, 'Failure')).toBe(
      'User is seeing the information about service details of namespace bookinfo with current health status Failure'
    );
  });
});

describe('substitutePromptVariables', () => {
  it('replaces known variables and clears unknown placeholders', () => {
    expect(
      substitutePromptVariables("Analyze the service '{service}' in namespace '{namespace}'{cluster}", {
        cluster: '',
        namespace: 'bookinfo',
        service: 'details'
      })
    ).toBe("Analyze the service 'details' in namespace 'bookinfo'");
    expect(substitutePromptVariables('Hello {unknown}', { service: 'details' })).toBe('Hello ');
  });
});

describe('buildPromptVariables', () => {
  it('includes health variables on detail views', () => {
    expect(
      buildPromptVariables(
        {
          isDetailView: true,
          namespace: 'bookinfo',
          resourceKind: 'service',
          resourceName: 'details'
        },
        'Degraded'
      )
    ).toMatchObject({
      health: 'Degraded',
      health_context: ' with current health status Degraded'
    });
  });

  it('includes cluster suffix only in multi-cluster environments', () => {
    mockIsMultiCluster = true;
    expect(
      buildPromptVariables({
        clusterName: 'east',
        isDetailView: true,
        namespace: 'bookinfo',
        resourceKind: 'service',
        resourceName: 'details'
      }).cluster
    ).toBe(" in cluster 'east'");
    mockIsMultiCluster = false;
  });
});

describe('substitutePrompts', () => {
  it('substitutes variables in all prompt fields', () => {
    const [prompt] = substitutePrompts(
      [
        {
          description: "Analyze the service '{service}' in namespace '{namespace}'",
          message: "Analyze the service '{service}' in namespace '{namespace}'",
          query: "Analyze the service '{service}' in namespace '{namespace}'{cluster} and report health issues.",
          title: 'Service Troubleshooting'
        }
      ],
      buildPromptVariables({
        isDetailView: true,
        namespace: 'bookinfo',
        resourceKind: 'service',
        resourceName: 'details'
      })
    );

    expect(prompt.query).toBe("Analyze the service 'details' in namespace 'bookinfo' and report health issues.");
  });
});

describe('buildUnhealthyResourcePrompts', () => {
  it('builds targeted troubleshooting prompts', () => {
    const prompts = buildUnhealthyResourcePrompts([
      {
        kind: 'service',
        name: 'productpage',
        namespace: 'bookinfo',
        status: 'Failure'
      }
    ]);

    expect(prompts[0].title).toBe('Investigate productpage');
    expect(prompts[0].query).toContain("failing service 'productpage'");
  });
});

describe('mergePromptsWithUnhealthy', () => {
  it('prepends unique unhealthy prompts before catalog prompts', () => {
    const catalog = [{ title: 'Service Health Analysis', query: 'Review services', message: 'Review services' }];
    const unhealthy = [
      { title: 'Investigate productpage', query: 'Investigate productpage', message: 'Investigate productpage' }
    ];

    expect(mergePromptsWithUnhealthy(catalog, unhealthy)).toEqual([...unhealthy, ...catalog]);
  });
});

describe('substitutePrompt', () => {
  it('falls back message to query when message is absent', () => {
    const prompt = substitutePrompt(
      {
        query: "Analyze the service '{service}' in namespace '{namespace}' and report issues.",
        title: 'Service Troubleshooting'
      },
      buildPromptVariables({
        isDetailView: true,
        namespace: 'bookinfo',
        resourceKind: 'service',
        resourceName: 'details'
      })
    );

    expect(prompt.message).toBe("Analyze the service 'details' in namespace 'bookinfo' and report issues.");
  });
});
