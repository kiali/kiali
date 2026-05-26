import { serverConfig } from '../config';

export interface ResourcePermissions {
  create: boolean;
  delete: boolean;
  update: boolean;
}

export function canCreate(privs?: ResourcePermissions): boolean {
  return privs !== undefined && privs.create && !serverConfig.deployment.viewOnlyMode;
}

export function canUpdate(privs?: ResourcePermissions): boolean {
  return privs !== undefined && privs.update && !serverConfig.deployment.viewOnlyMode;
}

export function canDelete(privs?: ResourcePermissions): boolean {
  return !!privs?.delete && !serverConfig.deployment.viewOnlyMode;
}
