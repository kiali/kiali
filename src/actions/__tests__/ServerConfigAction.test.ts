import { ServerConfigActions } from '../ServerConfigActions';
import { ServerConfig } from '../../store/Store';
import { serverConfig } from '../../config/serverConfig';
import { store } from '../../store/ConfigStore';

const config: ServerConfig = {
  istioNamespace: 'istio-system',
  istioLabels: { appLabelName: 'app', versionLabelName: 'version' },
  prometheus: { globalScrapeInterval: 15, storageTsdbRetention: 21600 }
};

describe('ServerConfigActions', () => {
  it('Set ServerConfig action success', () => {
    store.dispatch(ServerConfigActions.setServerConfig(config));
    expect(serverConfig().istioNamespace).toEqual(config.istioNamespace);
    expect(serverConfig().istioLabels).toEqual(config.istioLabels);
    expect(serverConfig().prometheus.globalScrapeInterval).toEqual(config.prometheus.globalScrapeInterval);
    expect(serverConfig().prometheus.storageTsdbRetention).toEqual(config.prometheus.storageTsdbRetention);
  });
});
