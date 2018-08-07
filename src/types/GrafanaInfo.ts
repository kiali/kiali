export default interface GrafanaInfo {
  url: string;
  serviceDashboardPath: string;
  workloadDashboardPath: string;
  varNamespace: string;
  varService: string;
  varWorkload: string;
}
