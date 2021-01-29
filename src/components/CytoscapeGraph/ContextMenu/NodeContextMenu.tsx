import * as React from 'react';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import { Paths } from '../../../config';
import { style } from 'typestyle';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { NodeType, DecoratedGraphNodeData } from 'types/Graph';
import { JaegerInfo } from 'types/JaegerInfo';
import history from 'app/History';

type ReduxProps = {
  jaegerInfo?: JaegerInfo;
};

const graphContextMenuContainerStyle = style({
  textAlign: 'left'
});

const graphContextMenuTitleStyle = style({
  textAlign: 'left',
  fontSize: '16px',
  borderBottom: '1px solid black'
});

const graphContextMenuSubTitleStyle = style({
  textAlign: 'left',
  fontSize: '14px',
  color: '#737679',
  fontWeight: 700,
  paddingTop: 2,
  paddingBottom: 4
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
type LinkParams = { namespace: string; name: string; type: string };

export class NodeContextMenu extends React.PureComponent<Props> {
  static derivedValuesFromProps(node: DecoratedGraphNodeData): LinkParams | undefined {
    const namespace: string = node.namespace;
    let name: string | undefined = undefined;
    let type: string | undefined = undefined;
    switch (node.nodeType) {
      case NodeType.APP:
      case NodeType.BOX: // we only support app box node graphs, so treat like app
        // Prefer workload type for nodes backed by a workload
        if (node.workload && node.parent) {
          name = node.workload;
          type = Paths.WORKLOADS;
        } else {
          type = Paths.APPLICATIONS;
          name = node.app;
        }
        break;
      case NodeType.SERVICE:
        type = node.isServiceEntry ? Paths.SERVICEENTRIES : Paths.SERVICES;
        name = node.service;
        break;
      case NodeType.WORKLOAD:
        name = node.workload;
        type = Paths.WORKLOADS;
        break;
    }

    return type && name ? { namespace, type, name } : undefined;
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
        {
          // Linter is not taking care that 'title' is passed as a property
          // eslint-disable-next-line
          external ? <a href={href} {...commonLinkProps} /> : <Link to={href} {...commonLinkProps} />
        }
      </div>
    );
  }

  render() {
    const linkParams = NodeContextMenu.derivedValuesFromProps(this.props);

    // Disable context menu if we are dealing with an aggregate (currently has no detail) or an inaccessible node
    if (!linkParams || this.props.isInaccessible) {
      this.props.contextMenu.disable();
      return null;
    }

    const options: ContextMenuOption[] = getOptionsFromLinkParams(linkParams, this.props.jaegerInfo);

    return (
      <div className={graphContextMenuContainerStyle}>
        <div className={graphContextMenuTitleStyle}>
          <strong>{linkParams.name}</strong>
        </div>
        <div className={graphContextMenuSubTitleStyle}>Show</div>
        {options.map(o => this.createMenuItem(o.url, o.text, o.target, o.external))}
      </div>
    );
  }

  private onClick = (_e: React.MouseEvent<HTMLAnchorElement>) => {
    this.props.contextMenu.hide(0);
  };
}

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

export const getOptions = (node: DecoratedGraphNodeData, jaegerInfo?: JaegerInfo): ContextMenuOption[] => {
  const linkParams = NodeContextMenu.derivedValuesFromProps(node);
  if (!linkParams) {
    return [];
  }
  return getOptionsFromLinkParams(linkParams, jaegerInfo);
};

const getOptionsFromLinkParams = (linkParams: LinkParams, jaegerInfo?: JaegerInfo): ContextMenuOption[] => {
  const options: ContextMenuOption[] = [];
  const { namespace, type, name } = linkParams;
  const detailsPageUrl = `/namespaces/${namespace}/${type}/${name}`;

  options.push({ text: 'Details', url: detailsPageUrl });
  if (type !== Paths.SERVICEENTRIES) {
    options.push({ text: 'Traffic', url: `${detailsPageUrl}?tab=traffic` });
    if (type === Paths.WORKLOADS) {
      options.push({ text: 'Logs', url: `${detailsPageUrl}?tab=logs` });
    }
    options.push({
      text: 'Inbound Metrics',
      url: `${detailsPageUrl}?tab=${type === Paths.SERVICES ? 'metrics' : 'in_metrics'}`
    });
    if (type !== Paths.SERVICES) {
      options.push({ text: 'Outbound Metrics', url: `${detailsPageUrl}?tab=out_metrics` });
    }
    if (type === Paths.APPLICATIONS && jaegerInfo && jaegerInfo.enabled) {
      if (jaegerInfo.integration) {
        options.push({ text: 'Traces', url: `${detailsPageUrl}?tab=traces` });
      } else if (jaegerInfo.url) {
        options.push({
          text: 'Show Traces',
          url: getJaegerURL(namespace, jaegerInfo.namespaceSelector, jaegerInfo.url, name),
          external: true,
          target: '_blank'
        });
      }
    }
  }

  return options;
};

const mapStateToProps = (state: KialiAppState) => ({
  jaegerInfo: state.jaegerState.info
});

export const NodeContextMenuContainer = connect(mapStateToProps)(NodeContextMenu);
