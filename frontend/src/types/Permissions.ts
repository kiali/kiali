import { serverConfig } from "../config";

export interface ResourcePermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
}


export function canCreate(privs: ResourcePermissions) {
  return privs.create && !serverConfig.deployment.viewOnlyMode;
}

export function canUpdate(privs: ResourcePermissions) {
  return privs.update && !serverConfig.deployment.viewOnlyMode;
}

export function canDelete(privs?: ResourcePermissions) {
  return privs?.delete && !serverConfig.deployment.viewOnlyMode;
}
