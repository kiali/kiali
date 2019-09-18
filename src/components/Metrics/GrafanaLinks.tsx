import * as React from 'react';
import { ToolbarItem } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { ExternalLink } from '@kiali/k-charted-pf4';

import { MetricsObjectTypes } from '../../types/Metrics';

export type Link = [string, string];

type Props = {
  links: Link[];
};

export class GrafanaLinks extends React.PureComponent<Props, {}> {
  static buildGrafanaLinks(modelLinks: ExternalLink[], namespace: string, object: string, objectType: MetricsObjectTypes, version?: string): Link[] {
    const links: [string, string][] = [];
    modelLinks.forEach(d => {
      const nsvar = d.variables.namespace ? `&${d.variables.namespace}=${namespace}` : '';
      const vervar = d.variables.version && version ? `&${d.variables.version}=${version}` : '';
      switch (objectType) {
        case MetricsObjectTypes.SERVICE:
          const fullServiceName = `${object}.${namespace}.svc.cluster.local`;
          if (d.variables.service) {
            const url = `${d.url}?${d.variables.service}=${fullServiceName}${nsvar}${vervar}`;
            links.push([d.name, url]);
          }
          break;
        case MetricsObjectTypes.WORKLOAD:
          if (d.variables.workload) {
            const url = `${d.url}?${d.variables.workload}=${object}${nsvar}${vervar}`;
            links.push([d.name, url]);
          }
          break;
        case MetricsObjectTypes.APP:
          if (d.variables.app) {
            const url = `${d.url}?${d.variables.app}=${object}${nsvar}${vervar}`;
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
    return (
      <>
        {this.props.links.length === 1 && (
          <ToolbarItem style={{ borderRight: 'none' }}>
            <a
              id={'grafana_link_0'}
              title={this.props.links[0][0]}
              href={this.props.links[0][1]}
              target="_blank"
              rel="noopener noreferrer"
            >
              View in Grafana <ExternalLinkAltIcon />
            </a>
          </ToolbarItem>
        )}
        {this.props.links.length > 1 && (
          <ToolbarItem style={{ borderRight: 'none' }}>
            View in Grafana:&nbsp;
            {this.props.links
              .map((link, idx) => (
                <a
                  id={'grafana_link_' + idx}
                  title={link[0]}
                  href={link[1]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
