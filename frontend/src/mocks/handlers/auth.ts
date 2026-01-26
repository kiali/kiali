import { http, HttpResponse } from 'msw';
import { AuthInfo, AuthStrategy } from '../../types/Auth';
import { getScenarioConfig } from '../scenarios';

// Generate cluster info from scenario - called dynamically
const generateClusterInfo = (): Record<string, { name: string }> => {
  const scenarioConfig = getScenarioConfig();
  const clusterInfo: Record<string, { name: string }> = {};
  scenarioConfig.clusters.forEach(cluster => {
    clusterInfo[cluster.name] = {
      name: cluster.name
    };
  });
  return clusterInfo;
};

// Generate auth info dynamically
const generateAuthInfo = (): AuthInfo => ({
  sessionInfo: {
    username: 'mock-user',
    expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    clusterInfo: generateClusterInfo()
  },
  strategy: AuthStrategy.anonymous
});

const mockLoginSession = {
  expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  username: 'mock-user'
};

export const authHandlers = [
  // Auth info - generated dynamically based on scenario
  http.get('*/api/auth/info', () => {
    return HttpResponse.json(generateAuthInfo());
  }),

  // Login/authenticate
  http.post('*/api/authenticate', () => {
    return HttpResponse.json(mockLoginSession);
  }),

  http.get('*/api/authenticate', () => {
    return HttpResponse.json(mockLoginSession);
  }),

  // Logout
  http.get('*/api/logout', () => {
    return HttpResponse.json({});
  })
];
