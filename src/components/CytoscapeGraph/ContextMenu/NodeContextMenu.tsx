import * as React from 'react';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import history from '../../../app/History';

export class NodeContextMenu extends React.PureComponent<NodeContextMenuProps> {
  // @todo: We need take care of this at global app level
  private static makeDetailsPageUrl(props: NodeContextMenuProps) {
    const namespace = props.namespace;
    const nodeType = props.nodeType;
    const workload = props.workload;
    let app = props.app;
    let urlNodeType = app;
    if (nodeType === 'app') {
      urlNodeType = 'applications';
    } else if (nodeType === 'service') {
      urlNodeType = 'services';
    } else if (workload) {
      urlNodeType = 'workloads';
      app = workload;
    }
    return `/namespaces/${namespace}/${urlNodeType}/${app}`;
  }

  render() {
    const version = this.props.version ? `${this.props.version}` : '';
    const detailsPageUrl = NodeContextMenu.makeDetailsPageUrl(this.props);
    return (
      <div className="kiali-graph-context-menu-container">
        <div className="kiali-graph-context-menu-title">
          <strong>{this.props.app}</strong>:{version}
        </div>
        <div className="kiali-graph-context-menu-item">
          <a onClick={this.redirectContextLink} className="kiali-graph-context-menu-item-link" href={detailsPageUrl}>
            Show Details
          </a>
        </div>
      </div>
    );
  }

  private redirectContextLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (e.target) {
      const anchor = e.target as HTMLAnchorElement;
      const href = anchor.getAttribute('href');
      if (href) {
        this.props.contextMenu.hide(0);
        history.push(href);
      }
    }
  };
}
