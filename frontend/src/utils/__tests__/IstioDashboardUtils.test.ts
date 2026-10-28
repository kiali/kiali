import type { Mock } from '@rstest/core';
import type { ExternalLink } from 'types/Dashboards';
import { ISTIO_ZTUNNEL_DASHBOARD } from 'types/Dashboards';
import {
  ISTIO_CONTROL_PLANE_DASHBOARD,
  ISTIO_MESH_DASHBOARD,
  ISTIO_PERFORMANCE_DASHBOARD,
  ISTIO_WASM_EXTENSION_DASHBOARD
} from 'types/GrafanaInfo';
import {
  filterIstioDashboardLinks,
  isSafeHttpUrl,
  istioDashboardViewTitle,
  loadIstioDashboardLinks
} from '../IstioDashboardUtils';
import { store } from 'store/ConfigStore';
import * as API from 'services/Api';
import { addError } from 'utils/AlertUtils';
import { MessageType } from 'types/NotificationCenter';

rstest.mock('utils/AlertUtils', () => ({
  addError: rstest.fn()
}));

rstest.mock('utils/I18nUtils', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    if (!opts) {
      return key;
    }
    return Object.entries(opts).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key);
  }
}));

const meshLink: ExternalLink = { name: ISTIO_MESH_DASHBOARD, url: 'https://grafana/mesh', variables: {} };
const controlPlaneLink: ExternalLink = {
  name: ISTIO_CONTROL_PLANE_DASHBOARD,
  url: 'https://grafana/control-plane',
  variables: {}
};
const performanceLink: ExternalLink = {
  name: ISTIO_PERFORMANCE_DASHBOARD,
  url: 'http://grafana/perf',
  variables: {}
};
const wasmLink: ExternalLink = { name: ISTIO_WASM_EXTENSION_DASHBOARD, url: 'https://grafana/wasm', variables: {} };
const ztunnelLink: ExternalLink = { name: ISTIO_ZTUNNEL_DASHBOARD, url: 'https://grafana/ztunnel', variables: {} };

describe('IstioDashboardUtils', () => {
  describe('isSafeHttpUrl', () => {
    it('accepts http and https URLs', () => {
      expect(isSafeHttpUrl('https://grafana.example/d/mesh')).toBe(true);
      expect(isSafeHttpUrl('http://localhost:3000/d/mesh')).toBe(true);
    });

    it('rejects non-http URLs', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('not a url')).toBe(false);
    });
  });

  describe('filterIstioDashboardLinks', () => {
    it('keeps control-plane dashboards in a stable order and drops others', () => {
      const filtered = filterIstioDashboardLinks(
        [
          ztunnelLink,
          wasmLink,
          meshLink,
          { name: 'Other', url: 'https://grafana/other', variables: {} },
          performanceLink
        ],
        'control-plane'
      );

      expect(filtered.map(link => link.name)).toEqual([
        ISTIO_MESH_DASHBOARD,
        ISTIO_PERFORMANCE_DASHBOARD,
        ISTIO_WASM_EXTENSION_DASHBOARD
      ]);
    });

    it('keeps only the ztunnel dashboard for ztunnel kind', () => {
      const filtered = filterIstioDashboardLinks([meshLink, ztunnelLink], 'ztunnel');
      expect(filtered).toEqual([ztunnelLink]);
    });

    it('drops unsafe URLs', () => {
      const filtered = filterIstioDashboardLinks(
        [{ name: ISTIO_MESH_DASHBOARD, url: 'javascript:alert(1)', variables: {} }],
        'control-plane'
      );
      expect(filtered).toEqual([]);
    });
  });

  describe('istioDashboardViewTitle', () => {
    it('names both the dashboard and the tool', () => {
      expect(istioDashboardViewTitle(ISTIO_MESH_DASHBOARD, 'Grafana')).toBe(`View ${ISTIO_MESH_DASHBOARD} in Grafana`);
      expect(istioDashboardViewTitle(ISTIO_MESH_DASHBOARD, 'Perses')).toBe(`View ${ISTIO_MESH_DASHBOARD} in Perses`);
    });
  });

  describe('loadIstioDashboardLinks', () => {
    const addErrorMock = addError as Mock;
    let getStateSpy: ReturnType<typeof rstest.spyOn>;
    let grafanaSpy: ReturnType<typeof rstest.spyOn>;
    let persesSpy: ReturnType<typeof rstest.spyOn>;

    beforeEach(() => {
      addErrorMock.mockReset();
      getStateSpy = rstest.spyOn(store, 'getState');
      grafanaSpy = rstest.spyOn(API, 'getGrafanaInfo');
      persesSpy = rstest.spyOn(API, 'getPersesInfo');
    });

    afterEach(() => {
      getStateSpy.mockRestore();
      grafanaSpy.mockRestore();
      persesSpy.mockRestore();
    });

    const mockStatusState = (externalServices: { name: string }[]): ReturnType<typeof store.getState> =>
      ({ statusState: { externalServices } }) as unknown as ReturnType<typeof store.getState>;

    it('returns empty lists when Grafana and Perses are not configured', async () => {
      getStateSpy.mockReturnValue(mockStatusState([]));

      await expect(loadIstioDashboardLinks('control-plane')).resolves.toEqual({ grafanaLinks: [], persesLinks: [] });
      expect(grafanaSpy).not.toHaveBeenCalled();
      expect(persesSpy).not.toHaveBeenCalled();
    });

    it('filters Grafana and Perses Istio dashboards independently', async () => {
      getStateSpy.mockReturnValue(mockStatusState([{ name: 'Grafana' }, { name: 'Perses' }]));
      grafanaSpy.mockResolvedValue({
        status: 200,
        data: { externalLinks: [meshLink, ztunnelLink, controlPlaneLink] }
      } as never);
      persesSpy.mockResolvedValue({
        status: 200,
        data: { externalLinks: [performanceLink, ztunnelLink] }
      } as never);

      await expect(loadIstioDashboardLinks('control-plane')).resolves.toEqual({
        grafanaLinks: [meshLink, controlPlaneLink],
        persesLinks: [performanceLink]
      });
    });

    it('treats HTTP 204 as no dashboards', async () => {
      getStateSpy.mockReturnValue(mockStatusState([{ name: 'grafana' }]));
      grafanaSpy.mockResolvedValue({ status: 204 } as never);

      await expect(loadIstioDashboardLinks('control-plane')).resolves.toEqual({ grafanaLinks: [], persesLinks: [] });
    });

    it('does not fail the other tool when Grafana fetch fails', async () => {
      getStateSpy.mockReturnValue(mockStatusState([{ name: 'Grafana' }, { name: 'Perses' }]));
      grafanaSpy.mockRejectedValue(new Error('grafana down'));
      persesSpy.mockResolvedValue({
        status: 200,
        data: { externalLinks: [ztunnelLink] }
      } as never);

      await expect(loadIstioDashboardLinks('ztunnel')).resolves.toEqual({
        grafanaLinks: [],
        persesLinks: [ztunnelLink]
      });
      expect(addErrorMock).toHaveBeenCalledWith(
        'Could not fetch Grafana info. Turning off links to Grafana.',
        expect.any(Error),
        false,
        MessageType.INFO
      );
    });
  });
});
