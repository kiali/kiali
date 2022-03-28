import * as React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { style } from 'typestyle';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import history from 'app/History';
import { NodeType, DecoratedGraphNodeData, BoxByType } from 'types/Graph';
import { JaegerInfo } from 'types/JaegerInfo';
import { KialiAppState } from 'store/Store';
import { Paths, serverConfig } from 'config';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import { getTitle } from 'pages/Graph/SummaryPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { renderBadgedName } from 'pages/Graph/SummaryLink';
import { PFColors } from 'components/Pf/PfColors';

type ReduxProps = {
  jaegerInfo?: JaegerInfo;
};

// Note, in the below styles we assign colors to be consistent with PF Dropdown
const contextMenu = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  textAlign: 'left'
});

const contextMenuHeader = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  marginBottom: '3px',
  textAlign: 'left'
});

const contextMenuSubTitle = style({
  color: PFColors.Black600,
  fontWeight: 700,
  paddingTop: 2,
  paddingBottom: 4
});

const contextMenuItem = style({
  textDecoration: 'none',
  $nest: {
    '&:hover': {
      backgroundColor: PFColors.Black200,
      color: PFColors.Blue400
    }
  }
});

const contextMenuItemLink = style({
  color: PFColors.Black900
});

type Props = NodeContextMenuProps & ReduxProps;
type LinkParams = { cluster: string; namespace: string; name: string; type: string };

export class NodeContextMenu extends React.PureComponent<Props> {
  static derivedValuesFromProps(node: DecoratedGraphNodeData): LinkParams | undefined {
    const cluster: string = node.cluster;
    const namespace: string = node.isServiceEntry ? node.isServiceEntry.namespace : node.namespace;
    let name: string | undefined = undefined;
    let type: string | undefined = undefined;
    switch (node.nodeType) {
      case NodeType.APP:
      case NodeType.BOX:
        // only app boxes have full context menus
        const isBox = node.isBox;
        if (!isBox || isBox === BoxByType.APP) {
          // Prefer workload links
          if (node.workload && node.parent) {
            name = node.workload;
            type = Paths.WORKLOADS;
          } else {
            type = Paths.APPLICATIONS;
            name = node.app;
          }
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

    return type && name ? { cluster, namespace, type, name } : undefined;
  }

  createMenuItem(href: string, title: string, target: string = '_self', external: boolean = false) {
    const commonLinkProps = {
      className: contextMenuItemLink,
      children: title,
      onClick: this.onClick,
      target
    };

    let item: any;
    if (external) {
      // Linter is not taking care that 'title' is passed as a property
      // eslint-disable-next-line
      item = (
        <a href={href} rel="noreferrer noopener" {...commonLinkProps}>
          {commonLinkProps.children} <ExternalLinkAltIcon />
        </a>
      );
    } else {
      item = <Link to={href} {...commonLinkProps} />;
    }

    return (
      <div key={title} className={contextMenuItem}>
        {item}
      </div>
    );
  }

  render() {
    const isBox = this.props.isBox;
    const title = isBox ? getTitle(isBox) : getTitle(this.props.nodeType);
    const header: React.ReactFragment = (
      <>
        {title}
        {(!isBox || isBox === BoxByType.APP) && (
          <div className={contextMenuHeader}>
            <PFBadge badge={PFBadges.Namespace} />
            {this.props.namespace}
          </div>
        )}
        {renderBadgedName(this.props)}
      </>
    );

    if (this.props.isHover) {
      return <div className={contextMenu}>{header}</div>;
    }

    const linkParams = NodeContextMenu.derivedValuesFromProps(this.props);

    // Disable context menu if we are dealing with an aggregate (currently has no detail) or an inaccessible node
    if (!linkParams || this.props.isInaccessible) {
      this.props.contextMenu.disable();
      return null;
    }

    // The getOptionsFromLinkParams function can potentially return a blank list if the
    // node associated to the context menu is for a remote cluster with no accessible Kialis.
    // That would lead to an empty menu. Here, we assume that whoever is the host/parent component,
    // that component won't render this context menu in case this menu would be blank. So, here
    // it's simply assumed that the context menu will look good.
    const options: ContextMenuOption[] = getOptionsFromLinkParams(linkParams, this.props.jaegerInfo);
    const menuOptions = (
      <>
        <div className={contextMenuSubTitle}>Show</div>
        {options.map(o => this.createMenuItem(o.url, o.text, o.target, o.external))}
      </>
    );

    return (
      <div className={contextMenu}>
        {header}
        <hr style={{ margin: '8px 0 5px 0' }} />
        {menuOptions}
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
  let options: ContextMenuOption[] = [];
  const { namespace, type, name, cluster } = linkParams;
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

  if (serverConfig.clusterInfo?.name && cluster !== serverConfig.clusterInfo.name) {
    const externalClusterInfo = serverConfig.clusters[cluster];
    const kialiInfo = externalClusterInfo?.kialiInstances?.find(instance => instance.url.length !== 0);
    if (kialiInfo === undefined) {
      options = options.filter(o => o.target === '_blank');
    } else {
      const externalKialiUrl = kialiInfo.url.replace(/\/$/g, '') + '/console';

      for (let idx = 0; idx < options.length; idx++) {
        if (options[idx].target !== '_blank') {
          options[idx].external = true;
          options[idx].target = '_blank';
          options[idx].url = externalKialiUrl + options[idx].url;
        }
      }
    }
  }

  return options;
};

const mapStateToProps = (state: KialiAppState) => ({
  jaegerInfo: state.jaegerState.info
});

export const NodeContextMenuContainer = connect(mapStateToProps)(NodeContextMenu);
