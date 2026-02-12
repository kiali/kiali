import { Status } from 'types/IstioStatus';

export type ClusterIssue = { issues: number; name: string };

export const isUnhealthy = (entity: { status?: Status | string }): boolean => entity.status !== Status.Healthy;
export const isHealthy = (entity: { status?: Status | string }): boolean => entity.status === Status.Healthy;
