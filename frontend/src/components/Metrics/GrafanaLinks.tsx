import * as React from 'react';
import { ToolbarItem } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import { MetricsObjectTypes } from 'types/Metrics';
import { ExternalLink, ISTIO_ZTUNNEL_DASHBOARD } from 'types/Dashboards';

type Props = {
  datasourceUID?: string;
  links: ExternalLink[];
  namespace: string;
  object: string;
  objectType: MetricsObjectTypes;
  version?: string;
};

export class GrafanaLinks extends React.PureComponent<Props, {}> {
  static buildGrafanaLinks(props: Props): [string, string][] {
    const links: [string, string][] = [];
    props.links.forEach(d => {
      if (MetricsObjectTypes.ZTUNNEL !== props.objectType || d.name !== ISTIO_ZTUNNEL_DASHBOARD) {
        const first = d.url.includes('?') ? '&' : '?';
        const nsvar = d.variables.namespace ? `&${d.variables.namespace}=${props.namespace}` : '';
        const dsvar =
          d.variables.datasource && props.datasourceUID ? `&${d.variables.datasource}=${props.datasourceUID}` : '';
        const vervar = d.variables.version && props.version ? `&${d.variables.version}=${props.version}` : '';
        switch (props.objectType) {
          case MetricsObjectTypes.SERVICE:
            const fullServiceName = `${props.object}.${props.namespace}.svc.cluster.local`;
            if (d.variables.service) {
              const url = `${d.url}${first}${d.variables.service}=${fullServiceName}${nsvar}${dsvar}${vervar}`;
              links.push([d.name, url]);
            }
            break;
          case MetricsObjectTypes.WORKLOAD:
            if (d.variables.workload) {
              const url = `${d.url}${first}${d.variables.workload}=${props.object}${nsvar}${dsvar}${vervar}`;
              links.push([d.name, url]);
            }
            break;
          case MetricsObjectTypes.APP:
            if (d.variables.app) {
              const url = `${d.url}${first}${d.variables.app}=${props.object}${nsvar}${dsvar}${vervar}`;
              links.push([d.name, url]);
            }
            break;
          default:
            break;
        }
      } else {
        if (MetricsObjectTypes.ZTUNNEL === props.objectType && d.name === ISTIO_ZTUNNEL_DASHBOARD) {
          links.push([d.name, d.url]);
        }
      }
    });
    return links;
  }

  render(): React.ReactElement {
    const links = GrafanaLinks.buildGrafanaLinks(this.props);
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
                <a id={`grafana_link_${idx}`} title={link[0]} href={link[1]} target="_blank" rel="noopener noreferrer">
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
