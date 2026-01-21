// Shared helper functions for traffic graph mock data

interface AppHealthData {
  requests: {
    healthAnnotations: Record<string, unknown>;
    inbound: { http: { '200': number } };
    outbound: { http: { '200': number } };
  };
  workloadStatuses: Array<{
    availableReplicas: number;
    currentReplicas: number;
    desiredReplicas: number;
    name: string;
    syncedProxies: number;
  }>;
}

interface ServiceHealthData {
  requests: {
    healthAnnotations: Record<string, unknown>;
    inbound: { http: { '200': number } };
    outbound: { http: { '200': number } };
  };
}

// Helper to create app health data
export const createAppHealthData = (workloadName: string): AppHealthData => ({
  requests: {
    healthAnnotations: {},
    inbound: { http: { '200': 100 } },
    outbound: { http: { '200': 100 } }
  },
  workloadStatuses: [
    {
      availableReplicas: 1,
      currentReplicas: 1,
      desiredReplicas: 1,
      name: workloadName,
      syncedProxies: 1
    }
  ]
});

// Helper to create service health data
export const createServiceHealthData = (): ServiceHealthData => ({
  requests: {
    healthAnnotations: {},
    inbound: { http: { '200': 100 } },
    outbound: { http: { '200': 100 } }
  }
});
