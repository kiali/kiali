import { GrafanaLinks } from '../GrafanaLinks';
import { MetricsObjectTypes } from 'types/Metrics';

describe('Grafana links', () => {
  it('build service links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'View in Grafana',
          url: 'http://grafana:3000',
          variables: { namespace: 'var-namespace', service: 'var-service', datasource: 'var-datasource' }
        },
        {
          name: 'View in Grafana 2',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace', service: 'var-service', datasource: 'var-datasource' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-service',
      objectType: MetricsObjectTypes.SERVICE
    });
    expect(links).toHaveLength(2);
    expect(links[0][0]).toEqual('View in Grafana');
    expect(links[0][1]).toEqual(
      'http://grafana:3000?var-service=my-service.my-namespace.svc.cluster.local&var-namespace=my-namespace'
    );
    expect(links[1][0]).toEqual('View in Grafana 2');
    expect(links[1][1]).toEqual(
      'http://grafana:3000?orgId=1&var-service=my-service.my-namespace.svc.cluster.local&var-namespace=my-namespace'
    );
  });

  it('build workload links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'View in Grafana',
          url: 'http://grafana:3000',
          variables: { namespace: 'var-namespace', workload: 'var-workload', datasource: 'var-datasource' }
        },
        {
          name: 'View in Grafana 2',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace', workload: 'var-workload' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-workload',
      datasourceUID: 'PROMETHEUSUID',
      objectType: MetricsObjectTypes.WORKLOAD
    });
    expect(links).toHaveLength(2);
    expect(links[0][0]).toEqual('View in Grafana');
    expect(links[0][1]).toEqual(
      'http://grafana:3000?var-workload=my-workload&var-namespace=my-namespace&var-datasource=PROMETHEUSUID'
    );
    expect(links[1][0]).toEqual('View in Grafana 2');
    expect(links[1][1]).toEqual('http://grafana:3000?orgId=1&var-workload=my-workload&var-namespace=my-namespace');
  });

  it('build app links', () => {
    const links = GrafanaLinks.buildGrafanaLinks({
      links: [
        {
          name: 'View in Grafana',
          url: 'http://grafana:3000',
          variables: {
            namespace: 'var-namespace',
            app: 'var-app',
            version: 'var-version',
            datasource: 'var-datasource'
          }
        },
        {
          name: 'View in Grafana 2',
          url: 'http://grafana:3000?orgId=1',
          variables: { namespace: 'var-namespace', app: 'var-app' }
        }
      ],
      namespace: 'my-namespace',
      object: 'my-app',
      objectType: MetricsObjectTypes.APP,
      version: 'v1'
    });
    expect(links).toHaveLength(2);
    expect(links[0][0]).toEqual('View in Grafana');
    expect(links[0][1]).toEqual('http://grafana:3000?var-app=my-app&var-namespace=my-namespace&var-version=v1');
    expect(links[1][0]).toEqual('View in Grafana 2');
    expect(links[1][1]).toEqual('http://grafana:3000?orgId=1&var-app=my-app&var-namespace=my-namespace');
  });
});
