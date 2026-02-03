import { Status } from 'types/IstioStatus';

export const isUnhealthy = (entity: { status?: Status | string }): boolean => entity.status !== Status.Healthy;
