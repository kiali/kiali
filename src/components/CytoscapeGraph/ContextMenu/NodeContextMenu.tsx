import * as React from 'react';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import { Paths } from '../../../config';
import { style } from 'typestyle';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { NodeType, DecoratedGraphNodeData } from 'types/Graph';
import history from 'app/History';

type ReduxProps = {
  jaegerEnabled: boolean;
  namespaceSelector: boolean;
  jaegerURL: string;
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

type Props = NodeContextMenuProps & ReduxProps;

export class NodeContextMenu extends React.PureComponent<Props> {
  static derivedValuesFromProps(node: DecoratedGraphNodeData) {
    const namespace: string = node.namespace;
    let name: string | undefined = '';
    let type = '';
    switch (node.nodeType) {
      case 'app':
        // Prefer workload type for nodes backed by a workload
        if (node.workload && node.parent) {
          name = node.workload;
          type = Paths.WORKLOADS;
        } else {
          type = Paths.APPLICATIONS;
          name = node.app;
        }
        break;
      case 'service':
        type = node.isServiceEntry ? Paths.SERVICEENTRIES : Paths.SERVICES;
        name = node.service;
        break;
      case 'workload':
        name = node.workload;
        type = Paths.WORKLOADS;
        break;
      default:
    }

    return { namespace, type, name };
  }

  createMenuItem(href: string, title: string, target: string = '_self', external: boolean = false) {
    const commonLinkProps = {
      className: graphContextMenuItemLinkStyle,
      children: title,
      onClick: this.onClick,
      target
    };

    return (
      <div className={graphContextMenuItemStyle}>
        {external ? <a href={href} {...commonLinkProps} /> : <Link to={href} {...commonLinkProps} />}
      </div>
    );
  }

  render() {
    // Disable context menu if we are dealing with a unknown or an inaccessible node
    if (this.props.nodeType === NodeType.UNKNOWN || this.props.isInaccessible) {
      this.props.contextMenu.disable();
      return null;
    }

    const { name } = NodeContextMenu.derivedValuesFromProps(this.props);
    const options: ContextMenuOption[] = getOptions(
      this.props,
      this.props.namespaceSelector,
      this.props.jaegerEnabled,
      this.props.jaegerURL
    );

    return (
      <div className={graphContextMenuContainerStyle}>
        <div className={graphContextMenuTitleStyle}>
          <strong>{name}</strong>
        </div>
        {options.map(o => this.createMenuItem(o.url, o.text, o.target, o.external))}
      </div>
    );
  }

  private onClick = (_e: React.MouseEvent<HTMLAnchorElement>) => {
    this.props.contextMenu.hide(0);
  };
}

// @todo: We need take care of this at global app level
const makeDetailsPageUrl = (namespace: string, type: string, name?: string): string => {
  return `/namespaces/${namespace}/${type}/${name}`;
};

const getJaegerURL = (namespace: string, namespaceSelector: boolean, jaegerURL: string, name?: string): string => {
  return `${jaegerURL}/search?service=${name}${namespaceSelector ? `.${namespace}` : ''}`;
};

export type ContextMenuOption = {
  text: string;
  url: string;
  external?: boolean;
  target?: string;
};

export const clickHandler = (o: ContextMenuOption) => {
  if (o.external) {
    window.open(o.url, o.target);
  } else {
    history.push(o.url);
  }
};

export const getOptions = (
  node: DecoratedGraphNodeData,
  namespaceSelector: boolean,
  jaegerEnabled?: boolean,
  jaegerUrl?: string
): ContextMenuOption[] => {
  const { namespace, type, name } = NodeContextMenu.derivedValuesFromProps(node);
  const detailsPageUrl = makeDetailsPageUrl(namespace, type, name);
  const options: ContextMenuOption[] = [];

  options.push({ text: 'Show Details', url: detailsPageUrl });
  if (type !== Paths.SERVICEENTRIES) {
    options.push({ text: 'Show Traffic', url: `${detailsPageUrl}?tab=traffic` });
    if (type === Paths.WORKLOADS) {
      options.push({ text: 'Show Logs', url: `${detailsPageUrl}?tab=logs` });
    }
    options.push({
      text: 'Show Inbound Metrics',
      url: `${detailsPageUrl}?tab=${type === Paths.SERVICES ? 'metrics' : 'in_metrics'}`
    });
    if (type !== Paths.SERVICES) {
      options.push({ text: 'Show Outbound Metrics', url: `${detailsPageUrl}?tab=out_metrics` });
    }
    if (type === Paths.SERVICES) {
      jaegerEnabled
        ? options.push({ text: 'Show Traces', url: `${detailsPageUrl}?tab=traces` })
        : options.push({
            text: 'Show Traces',
            url: getJaegerURL(namespace, namespaceSelector, jaegerUrl!, name),
            external: true,
            target: '_blank'
          });
    }
  }

  return options;
};

const mapStateToProps = (state: KialiAppState) => ({
  jaegerEnabled: state.jaegerState ? state.jaegerState.enabled : false,
  namespaceSelector: state.jaegerState ? state.jaegerState.namespaceSelector : true,
  jaegerURL: state.jaegerState ? state.jaegerState.url : ''
});

export const NodeContextMenuContainer = connect(mapStateToProps)(NodeContextMenu);
