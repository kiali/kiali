
export interface Runtime {
  name: string;
  dashboardRefs: DashboardRef[];
}

export interface DashboardRef {
  template: string;
  title: string;
}
