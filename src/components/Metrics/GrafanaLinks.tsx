import * as React from 'react';
import { ToolbarItem } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { ExternalLink } from '@kiali/k-charted-pf4';

import { MetricsObjectTypes } from '../../types/Metrics';

type Props = {
  links: ExternalLink[];
  namespace: string;
  object: string;
  objectType: MetricsObjectTypes;
  version?: string;
};

export class GrafanaLinks extends React.PureComponent<Props, {}> {
  private buildGrafanaLinks(): [string, string][] {
    const links: [string, string][] = [];
    this.props.links.forEach(d => {
      const nsvar = d.variables.namespace ? `&${d.variables.namespace}=${this.props.namespace}` : '';
      const vervar = d.variables.version && this.props.version ? `&${d.variables.version}=${this.props.version}` : '';
      switch (this.props.objectType) {
        case MetricsObjectTypes.SERVICE:
          const fullServiceName = `${this.props.object}.${this.props.namespace}.svc.cluster.local`;
          if (d.variables.service) {
            const url = `${d.url}?${d.variables.service}=${fullServiceName}${nsvar}${vervar}`;
            links.push([d.name, url]);
          }
          break;
        case MetricsObjectTypes.WORKLOAD:
          if (d.variables.workload) {
            const url = `${d.url}?${d.variables.workload}=${this.props.object}${nsvar}${vervar}`;
            links.push([d.name, url]);
          }
          break;
        case MetricsObjectTypes.APP:
          if (d.variables.app) {
            const url = `${d.url}?${d.variables.app}=${this.props.object}${nsvar}${vervar}`;
            links.push([d.name, url]);
          }
          break;
        default:
          break;
      }
    });
    return links;
  }

  render() {
    const links = this.buildGrafanaLinks();
    return (
      <>
        {links.length === 1 && (
          <ToolbarItem style={{ borderRight: 'none' }}>
            <a id={'grafana_link_0'} title={links[0][0]} href={links[0][1]} target="_blank" rel="noopener noreferrer">
              View in Grafana <ExternalLinkAltIcon />
            </a>
          </ToolbarItem>
        )}
        {links.length > 1 && (
          <ToolbarItem style={{ borderRight: 'none' }}>
            View in Grafana:&nbsp;
            {links
              .map((link, idx) => (
                <a id={'grafana_link_' + idx} title={link[0]} href={link[1]} target="_blank" rel="noopener noreferrer">
                  {link[0]} <ExternalLinkAltIcon />
                </a>
              ))
              .reduce((prev, curr) => [prev, ', ', curr] as any)}
          </ToolbarItem>
        )}
      </>
    );
  }
}
