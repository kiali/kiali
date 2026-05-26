import { serverConfig } from 'config';
import { IstioConfigDetailsPageComponent } from '../IstioConfigDetailsPage';

describe('IstioConfigDetailsPageComponent', () => {
  const origViewOnly = serverConfig.deployment.viewOnlyMode;

  const props = {
    dispatch: jest.fn(),
    istioConfigId: {
      namespace: 'bookinfo',
      objectGroup: 'networking.istio.io',
      objectKind: 'VirtualService',
      objectName: 'reviews',
      objectVersion: 'v1'
    },
    kiosk: '',
    theme: 'Light'
  } as any;

  const setPermissions = (page: IstioConfigDetailsPageComponent): void => {
    (page as any).state = {
      ...page.state,
      istioObjectDetails: {
        permissions: {
          create: true,
          update: true,
          delete: true
        }
      }
    };
  };

  afterEach(() => {
    serverConfig.deployment.viewOnlyMode = origViewOnly;
  });

  it('disables mutating actions when viewOnlyMode is true', () => {
    serverConfig.deployment.viewOnlyMode = true;

    const page = new IstioConfigDetailsPageComponent(props);
    setPermissions(page);

    expect(page.canUpdate()).toBe(false);
    expect(page.canDelete()).toBe(false);
  });

  it('keeps mutating actions available when viewOnlyMode is false', () => {
    serverConfig.deployment.viewOnlyMode = false;

    const page = new IstioConfigDetailsPageComponent(props);
    setPermissions(page);

    expect(page.canUpdate()).toBe(true);
    expect(page.canDelete()).toBe(true);
  });
});
