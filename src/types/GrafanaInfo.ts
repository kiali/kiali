export interface GrafanaInfo {
  dashboards: GrafanaDashboardInfo[];
}

interface GrafanaDashboardInfo {
  url: string;
  name: string;
  variables: GrafanaVariablesConfig;
}

interface GrafanaVariablesConfig {
  app?: string;
  namespace?: string;
  service?: string;
  workload?: string;
}
