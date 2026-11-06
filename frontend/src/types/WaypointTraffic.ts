export type WaypointBinding = {
  cluster: string;
  name: string;
  namespace: string;
  role: 'primary' | 'canary';
};

export type WaypointTrafficSplit = {
  canary?: WaypointBinding;
  canaryWeight: number;
  configLevel?: string;
  primary: WaypointBinding;
  primaryWeight: number;
};
