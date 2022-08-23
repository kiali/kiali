import * as React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { style } from 'typestyle';
import { Spinner, Tooltip, TooltipPosition } from "@patternfly/react-core";
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import history from 'app/History';
import { BoxByType, DecoratedGraphNodeData, NodeType } from 'types/Graph';
import { JaegerInfo } from 'types/JaegerInfo';
import { durationSelector } from "store/Selectors";
import { KialiAppState } from 'store/Store';
import { Paths, serverConfig } from 'config';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import { getTitle } from 'pages/Graph/SummaryPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { renderBadgedName } from 'pages/Graph/SummaryLink';
import { PFColors } from 'components/Pf/PfColors';
import {
  SERVICE_WIZARD_ACTIONS,
  WIZARD_TITLES,
  WizardAction
} from "../../IstioWizards/WizardActions";
import { DELETE_TRAFFIC_ROUTING } from "../../IstioWizards/ServiceWizardActionsDropdownGroup";
import { isParentKiosk, kioskContextMenuAction } from "../../Kiosk/KioskActions";
import { DurationInSeconds, TimeInMilliseconds } from "types/Common";
import { useServiceDetailForGraphNode } from "../../../hooks/services";
import { canDelete } from "../../../types/Permissions";
import { getServiceDetailsUpdateLabel, hasServiceDetailsTrafficRouting } from "../../../types/ServiceInfo";

type ReduxProps = {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
  kiosk: string;
  updateTime: TimeInMilliseconds;
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

function getLinkParamsForNode(node: DecoratedGraphNodeData): LinkParams | undefined {
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

export function NodeContextMenu(props: Props) {
  const [serviceDetails, gateways, peerAuthentications, isServiceDetailsLoading] = useServiceDetailForGraphNode(props, true, props.duration, props.updateTime);
  const updateLabel = getServiceDetailsUpdateLabel(serviceDetails);

  // TODO: Deduplicate
  function getDropdownItemTooltipMessage(): string {
    if (serverConfig.deployment.viewOnlyMode) {
      return 'User does not have permission';
    } else if (hasServiceDetailsTrafficRouting(serviceDetails)) {
      return 'Traffic routing already exists for this service';
    } else {
      return "Traffic routing doesn't exists for this service";
    }
  }

  function createMenuItem(href: string, title: string, target: string = '_self', external: boolean = false) {
    const commonLinkProps = {
      className: contextMenuItemLink,
      children: title,
      onClick: onClick,
      target
    };
    let item: any;
    if (external) {
      item = (
        <a href={href} rel="noreferrer noopener" {...commonLinkProps}>
          {commonLinkProps.children} <ExternalLinkAltIcon />
        </a>
      );
    } else {
      // Kiosk actions are used when the kiosk specifies a parent,
      // otherwise the kiosk=true will keep the links inside Kiali
      if (isParentKiosk(props.kiosk)) {
        item =
          <Link
            to={''}
            onClick={() => {
              kioskContextMenuAction(href);
            }}
            className={commonLinkProps.className}
            children={commonLinkProps.children}
          />;
      } else {
        item = <Link to={href} {...commonLinkProps} />;
      }
    }

    return (
      <div key={title} className={contextMenuItem}>
        {item}
      </div>
    );
  }

  function onClick(_e: React.MouseEvent<HTMLAnchorElement>) {
    props.contextMenu.hide(0);
  }

  function handleClickWizard(e: React.MouseEvent<HTMLAnchorElement>, eventKey: WizardAction) {
    e.preventDefault();
    props.contextMenu.hide(0);

    if (props.onLaunchWizard && serviceDetails && gateways && peerAuthentications) {
      props.onLaunchWizard(eventKey, updateLabel.length === 0 ? 'create' : 'update', props.namespace, serviceDetails, gateways, peerAuthentications);
    }
  }

  function handleDeleteTrafficRouting(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    props.contextMenu.hide(0);

    if (props.onDeleteTrafficRouting && serviceDetails) {
      props.onDeleteTrafficRouting(DELETE_TRAFFIC_ROUTING, serviceDetails);
    }
  }

  function renderHeader() {
    return (
      <>
        {props.isBox ? getTitle(props.isBox) : getTitle(props.nodeType)}
        {(!props.isBox || props.isBox === BoxByType.APP) && (
          <div className={contextMenuHeader}>
            <PFBadge badge={PFBadges.Namespace} size="sm" />
            {props.namespace}
          </div>
        )}
        {renderBadgedName(props)}
      </>
    );
  }

  function renderWizardActionItem(eventKey: string) {
    const enabledItem = !hasServiceDetailsTrafficRouting(serviceDetails) || (hasServiceDetailsTrafficRouting(serviceDetails) && updateLabel === eventKey);

    // An Item is enabled under two conditions:
    // a) No traffic -> Wizard can create new one
    // b) Existing traffic generated by the traffic -> Wizard can update that scenario
    // Otherwise, the item should be disabled
    if (!enabledItem) {
      return (
        <div key={eventKey} className={contextMenuItem} style={{color: '#d2d2d2'}}>
          <Tooltip position={TooltipPosition.left} content={<>{getDropdownItemTooltipMessage()}</>}>
            <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{WIZARD_TITLES[eventKey]}</div>
          </Tooltip>
        </div>
      )
    } else {
      return (
        <div key={eventKey} className={contextMenuItem} data-test={eventKey + '_action'}>
          <a href="#" rel="noreferrer noopener" className={contextMenuItemLink} onClick={(e) => handleClickWizard(e, eventKey as WizardAction)}>
            {WIZARD_TITLES[eventKey]}
          </a>
        </div>
      );
    }
  }

  function renderDeleteTrafficRoutingItem() {
    if (!canDelete(serviceDetails?.istioPermissions) || !hasServiceDetailsTrafficRouting(serviceDetails) /*|| props.isDisabled*/) {
      return (
        <div className={contextMenuItem} style={{color: '#d2d2d2'}}>
          <Tooltip position={TooltipPosition.left} content={<>{getDropdownItemTooltipMessage()}</>}>
            <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>Delete Traffic Routing</div>
          </Tooltip>
        </div>
      );
    } else {
      return (
        <div className={contextMenuItem}>
          <a href="#" rel="noreferrer noopener" className={contextMenuItemLink} onClick={handleDeleteTrafficRouting} data-test="delete-traffic-routing">
            Delete Traffic Routing
          </a>
        </div>
      );
    }
  }

  function renderWizardsItems() {
    if (isServiceDetailsLoading) {
      return (
        <>
          <hr style={{ margin: '8px 0 5px 0' }} />
          <div className={contextMenuSubTitle}>Actions</div>
          <div className={contextMenuItem}>
            <Spinner isSVG={true} size="md" aria-label="Loading actions..." />
          </div>
        </>
      );
    }

    if (serviceDetails) {
      return (
        <>
          <hr style={{ margin: '8px 0 5px 0' }} />
          <div className={contextMenuSubTitle}>{updateLabel === '' ? 'Create' : 'Update'}</div>
          {SERVICE_WIZARD_ACTIONS.map(eventKey => renderWizardActionItem(eventKey))}
          <hr style={{ margin: '8px 0 5px 0' }} />
          {renderDeleteTrafficRoutingItem()}
        </>
      );
    }

    return null;
  }

  function renderFullContextMenu(linkParams: LinkParams) {
    // The getOptionsFromLinkParams function can potentially return a blank list if the
    // node associated to the context menu is for a remote cluster with no accessible Kialis.
    // That would lead to an empty menu. Here, we assume that whoever is the host/parent component,
    // that component won't render this context menu in case this menu would be blank. So, here
    // it's simply assumed that the context menu will look good.
    const options: ContextMenuOption[] = getOptionsFromLinkParams(linkParams, props.jaegerInfo);
    const menuOptions = (
      <>
        <div className={contextMenuSubTitle}>Show</div>
        {options.map(o => createMenuItem(o.url, o.text, o.target, o.external))}
      </>
    );

    return (
      <div className={contextMenu} data-test="graph-node-context-menu">
        {renderHeader()}
        <hr style={{ margin: '8px 0 5px 0' }} />
        {menuOptions}
        {renderWizardsItems()}
      </div>
    );
  }

  // render()
  if (props.isHover) {
    return <div className={contextMenu}>{renderHeader()}</div>;
  }

  const linkParams = getLinkParamsForNode(props);

  // Disable context menu if we are dealing with an aggregate (currently has no detail) or an inaccessible node
  if (!linkParams || props.isInaccessible) {
    props.contextMenu.disable();
    return null;
  }

  return renderFullContextMenu(linkParams);
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

export const clickHandler = (o: ContextMenuOption, kiosk: string) => {
  if (o.external) {
    window.open(o.url, o.target);
  } else {
    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(o.url);
    } else {
      history.push(o.url);
    }
  }
};

export const getOptions = (node: DecoratedGraphNodeData, jaegerInfo?: JaegerInfo): ContextMenuOption[] => {
  const linkParams = getLinkParamsForNode(node);
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
  duration: durationSelector(state),
  updateTime: state.graph.updateTime,
  jaegerInfo: state.jaegerState.info,
  kiosk: state.globalState.kiosk
});

export const NodeContextMenuContainer = connect(mapStateToProps)(NodeContextMenu);
