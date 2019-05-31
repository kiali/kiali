import * as React from 'react';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import { JaegerSearchOptions, JaegerURLSearch } from '../../JaegerIntegration/RouteHelper';
import history from '../../../app/History';
import { Paths } from '../../../config';
import { style } from 'typestyle';

type NodeContextMenuState = {
  nodeType: string;
  app: string | undefined;
};

const graphContextMenuContainerStyle = style({
  textAlign: 'left'
});

const graphContextMenuTitleStyle = style({
  textAlign: 'left',
  fontSize: '16px',
  borderBottom: '1px solid black'
});

const graphContextMenuItemStyle = style({
  textAlign: 'left',
  fontSize: '12px',
  textDecoration: 'none',
  $nest: {
    '&:hover': {
      backgroundColor: '#def3ff',
      color: '#4d5258'
    }
  }
});

const graphContextMenuItemLinkStyle = style({
  color: '#363636'
});

export class NodeContextMenu extends React.PureComponent<NodeContextMenuProps, NodeContextMenuState> {
  constructor(props: NodeContextMenuProps) {
    super(props);
    let app: string | undefined = '';
    let nodeType = '';
    switch (this.props.nodeType) {
      case 'app':
        nodeType = Paths.APPLICATIONS;
        app = this.props.app;
        break;
      case 'service':
        nodeType = Paths.SERVICES;
        app = this.props.service;
        break;
      case 'workload':
        app = this.props.workload;
        nodeType = Paths.WORKLOADS;
        break;
      default:
    }
    this.state = { nodeType, app };
  }
  // @todo: We need take care of this at global app level
  makeDetailsPageUrl() {
    return `/namespaces/${this.props.namespace}/${this.state.nodeType}/${this.state.app}`;
  }

  getJaegerURL() {
    let tracesUrl = `/jaeger?namespaces=${this.props.namespace}&service=${this.state.app}.${this.props.namespace}`;
    if (!this.props.jaegerIntegration) {
      const url = new JaegerURLSearch(this.props.jaegerURL, false);
      const options: JaegerSearchOptions = {
        serviceSelected: `${this.state.app}.${this.props.namespace}`,
        limit: 20,
        start: '',
        end: '',
        minDuration: '',
        maxDuration: '',
        lookback: '3600',
        tags: ''
      };

      tracesUrl = url.createRoute(options);
    }
    return tracesUrl;
  }

  createMenuItem(href: string, title: string, target: string = '_self') {
    return (
      <div className={graphContextMenuItemStyle}>
        <a onClick={this.redirectContextLink} className={graphContextMenuItemLinkStyle} target={target} href={href}>
          {title}
        </a>
      </div>
    );
  }

  render() {
    const version = this.props.version !== '' ? `:${this.props.version}` : '';
    const detailsPageUrl = this.makeDetailsPageUrl();
    const { nodeType, app } = this.state;
    return (
      <div className={graphContextMenuContainerStyle}>
        <div className={graphContextMenuTitleStyle}>
          <strong>{app}</strong>
          {version}
        </div>
        {this.createMenuItem(detailsPageUrl, 'Show Details')}
        {this.createMenuItem(`${detailsPageUrl}?tab=traffic`, 'Show Traffic')}
        {nodeType === Paths.WORKLOADS && this.createMenuItem(`${detailsPageUrl}?tab=logs`, 'Show Logs')}
        {this.createMenuItem(
          `${detailsPageUrl}?tab=${nodeType === Paths.SERVICES ? 'metrics' : 'in_metrics'}`,
          'Show Inbound Metrics'
        )}
        {nodeType !== Paths.SERVICES &&
          this.createMenuItem(`${detailsPageUrl}?tab=out_metrics`, 'Show Outbound Metrics')}
        {nodeType === Paths.SERVICES &&
          this.props.jaegerURL !== '' &&
          this.createMenuItem(this.getJaegerURL(), 'Show Traces', this.props.jaegerIntegration ? '_self' : '_blank')}
      </div>
    );
  }

  private redirectContextLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.target) {
      const anchor = e.target as HTMLAnchorElement;
      const href = anchor.getAttribute('href');
      const newTab = anchor.getAttribute('target') === '_blank';
      if (href && !newTab) {
        e.preventDefault();
        this.props.contextMenu.hide(0);
        history.push(href);
      }
    }
  };
}
