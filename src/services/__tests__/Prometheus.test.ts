import { computePrometheusRateParams } from '../Prometheus';
import { ServerConfigActions } from '../../actions/ServerConfigActions';
import { ServerConfig } from '../../store/Store';
import { store } from '../../store/ConfigStore';

const mockServerConfig: ServerConfig = {
  istioNamespace: 'istio-system',
  istioLabels: { AppLabelName: 'app', VersionLabelName: 'version' },
  prometheus: { globalScrapeInterval: 15 }
};

describe('Prometheus service', () => {
  it('should compute prometheus rate interval default', () => {
    store.dispatch(ServerConfigActions.setServerConfig(mockServerConfig));
    const res = computePrometheusRateParams(3600);
    expect(res.step).toBe(72);
    expect(res.rateInterval).toBe('72s');
  });

  it('should compute prometheus rate interval with expected datapoints', () => {
    store.dispatch(ServerConfigActions.setServerConfig(mockServerConfig));
    const res = computePrometheusRateParams(3600, 10);
    expect(res.step).toBe(360);
    expect(res.rateInterval).toBe('360s');
  });

  it('should compute prometheus rate interval minimized', () => {
    store.dispatch(ServerConfigActions.setServerConfig(mockServerConfig));
    const res = computePrometheusRateParams(60, 30);
    expect(res.step).toBe(30);
    expect(res.rateInterval).toBe('30s');
  });

  it('should compute prometheus rate interval minimized for custom scrape', () => {
    store.dispatch(ServerConfigActions.setServerConfig(mockServerConfig));
    const res = computePrometheusRateParams(60, 30, 5);
    expect(res.step).toBe(10);
    expect(res.rateInterval).toBe('10s');
  });
});
