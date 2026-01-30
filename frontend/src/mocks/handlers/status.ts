import { http, HttpResponse } from 'msw';
import { StatusState, StatusKey } from '../../types/StatusState';

const mockStatus: StatusState = {
  status: {
    [StatusKey.KIALI_CORE_VERSION]: '2.20.0-mock',
    [StatusKey.KIALI_CORE_COMMIT_HASH]: 'abc123mock',
    [StatusKey.KIALI_CONTAINER_VERSION]: '2.20.0-mock',
    [StatusKey.KIALI_STATE]: 'running'
  },
  externalServices: [
    {
      name: 'Istio',
      version: '1.28.0'
    },
    {
      name: 'jaeger',
      url: 'http://jaeger-query:16686',
      version: '1.62.0'
    },
    {
      name: 'Kubernetes',
      version: '1.33.0'
    },
    {
      name: 'Prometheus',
      url: 'http://prometheus:9090',
      version: '2.45.0'
    }
  ],
  warningMessages: [],
  istioEnvironment: {
    istioAPIEnabled: true
  }
};

export const statusHandlers = [
  http.get('*/api/status', () => {
    return HttpResponse.json(mockStatus);
  })
];
