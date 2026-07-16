import { serverConfig } from 'config';
import { canDelete, canUpdate } from 'types/Permissions';
import type { ResourcePermissions } from 'types/Permissions';

describe('Permissions helpers', () => {
  const origViewOnly = serverConfig.deployment.viewOnlyMode;

  const permissions: ResourcePermissions = {
    create: true,
    delete: true,
    update: true
  };

  afterEach(() => {
    serverConfig.deployment.viewOnlyMode = origViewOnly;
  });

  it('disables mutating actions when viewOnlyMode is true', () => {
    serverConfig.deployment.viewOnlyMode = true;

    expect(canUpdate(permissions)).toBe(false);
    expect(canDelete(permissions)).toBe(false);
  });

  it('keeps mutating actions available when viewOnlyMode is false', () => {
    serverConfig.deployment.viewOnlyMode = false;

    expect(canUpdate(permissions)).toBe(true);
    expect(canDelete(permissions)).toBe(true);
  });
});
