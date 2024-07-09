import * as React from 'react';
import { connect } from 'react-redux';
import { kialiStyle } from 'styles/StyleUtils';
import { Spinner, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { router } from 'app/History';
import { BoxByType, DecoratedGraphNodeData, NodeType } from 'types/Graph';
import { TracingInfo } from 'types/TracingInfo';
import { durationSelector } from 'store/Selectors';
import { KialiAppState } from 'store/Store';
import { isMultiCluster, Paths, serverConfig } from 'config';
import { NodeContextMenuProps } from '../CytoscapeContextMenu';
import { getTitle } from 'pages/Graph/SummaryPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { renderBadgedName } from 'pages/Graph/SummaryLink';
import { PFColors } from 'components/Pf/PfColors';
import { SERVICE_WIZARD_ACTIONS, WIZARD_TITLES, WizardAction } from '../../IstioWizards/WizardActions';
import { DELETE_TRAFFIC_ROUTING } from '../../IstioWizards/ServiceWizardActionsDropdownGroup';
import { isParentKiosk, kioskContextMenuAction } from '../../Kiosk/KioskActions';
import { DurationInSeconds, TimeInMilliseconds } from 'types/Common';
import { useServiceDetailForGraphNode } from '../../../hooks/services';
import { canDelete } from '../../../types/Permissions';
import { getServiceDetailsUpdateLabel, hasServiceDetailsTrafficRouting } from '../../../types/ServiceInfo';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  duration: DurationInSeconds;
  kiosk: string;
  tracingInfo?: TracingInfo;
  updateTime: TimeInMilliseconds;
};

// Note, in the below styles we assign colors to be consistent with PF Dropdown
const contextMenu = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  textAlign: 'left'
});

const contextMenuHeader = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

const contextMenuSubTitle = kialiStyle({
  color: PFColors.Color200,
  fontWeight: 700,
  paddingTop: '0.125rem',
  paddingBottom: '0.25rem'
});

const contextMenuItem = kialiStyle({
  textDecoration: 'none',
  $nest: {
    '&:hover': {
      backgroundColor: PFColors.BackgroundColor200,
      color: PFColors.Link
    }
  }
});

const contextMenuItemLink = kialiStyle({
  color: PFColors.Color100
});

const hrStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: '0.5rem 0 0.25rem 0'
});

type Props = NodeContextMenuProps & ReduxProps;
type LinkParams = { cluster?: string; name: string; namespace: string; type: string };

const getLinkParamsForNode = (node: DecoratedGraphNodeData): LinkParams | undefined => {
  const namespace: string = node.isServiceEntry ? node.isServiceEntry.namespace : node.namespace;

  let cluster = node.cluster;
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

  return type && name ? { namespace, type, name, cluster } : undefined;
};

export const NodeContextMenuComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  const [serviceDetails, gateways, peerAuthentications, isServiceDetailsLoading] = useServiceDetailForGraphNode(
    props,
    !props.isInaccessible,
    props.duration,
    props.updateTime
  );

  const updateLabel = getServiceDetailsUpdateLabel(serviceDetails);

  // TODO: Deduplicate
  const getDropdownItemTooltipMessage = (): string => {
    if (serverConfig.deployment.viewOnlyMode) {
      return t('User does not have permission');
    } else if (hasServiceDetailsTrafficRouting(serviceDetails)) {
      return t('Traffic routing already exists for this service');
    } else {
      return t("Traffic routing doesn't exist for this service");
    }
  };

  const createMenuItem = (href: string, title: string, target = '_self', external = false): React.ReactNode => {
    const commonLinkProps = {
      className: contextMenuItemLink,
      children: title,
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
        item = (
          <a
            onClick={() => {
              kioskContextMenuAction(href);
            }}
            className={commonLinkProps.className}
            children={commonLinkProps.children}
          />
        );
      } else {
        item = <a {...commonLinkProps} onClick={() => onClick(href)} />;
      }
    }

    return (
      <div key={title} className={contextMenuItem}>
        {item}
      </div>
    );
  };

  const onClick = (href: string): void => {
    props.contextMenu.hide(0);
    router.navigate(href);
  };

  const handleClickWizard = (e: React.MouseEvent<HTMLAnchorElement>, eventKey: WizardAction): void => {
    e.preventDefault();
    props.contextMenu.hide(0);

    if (props.onLaunchWizard && serviceDetails && gateways && peerAuthentications) {
      props.onLaunchWizard(
        eventKey,
        updateLabel.length === 0 ? 'create' : 'update',
        props.namespace,
        serviceDetails,
        gateways,
        peerAuthentications
      );
    }
  };

  const handleDeleteTrafficRouting = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    props.contextMenu.hide(0);

    if (props.onDeleteTrafficRouting && serviceDetails) {
      props.onDeleteTrafficRouting(DELETE_TRAFFIC_ROUTING, serviceDetails);
    }
  };

  const renderHeader = (): React.ReactNode => {
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
  };

  const renderWizardActionItem = (eventKey: string): React.ReactNode => {
    const enabledItem =
      !hasServiceDetailsTrafficRouting(serviceDetails) ||
      (hasServiceDetailsTrafficRouting(serviceDetails) && updateLabel === eventKey);

    // An Item is enabled under two conditions:
    // a) No traffic -> Wizard can create new one
    // b) Existing traffic generated by the traffic -> Wizard can update that scenario
    // Otherwise, the item should be disabled
    if (!enabledItem) {
      return (
        <div key={eventKey} className={contextMenuItem} style={{ color: PFColors.Color200 }}>
          <Tooltip position={TooltipPosition.left} content={<>{getDropdownItemTooltipMessage()}</>}>
            <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{WIZARD_TITLES[eventKey]}</div>
          </Tooltip>
        </div>
      );
    } else {
      return (
        <div key={eventKey} className={contextMenuItem} data-test={`${eventKey}_action`}>
          <a
            href="#"
            rel="noreferrer noopener"
            className={contextMenuItemLink}
            onClick={e => handleClickWizard(e, eventKey as WizardAction)}
          >
            {WIZARD_TITLES[eventKey]}
          </a>
        </div>
      );
    }
  };

  const renderDeleteTrafficRoutingItem = (): React.ReactNode => {
    if (
      !canDelete(serviceDetails?.istioPermissions) ||
      !hasServiceDetailsTrafficRouting(serviceDetails) /*|| props.isDisabled*/
    ) {
      return (
        <div className={contextMenuItem} style={{ color: PFColors.Color200 }}>
          <Tooltip position={TooltipPosition.left} content={<>{getDropdownItemTooltipMessage()}</>}>
            <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>Delete Traffic Routing</div>
          </Tooltip>
        </div>
      );
    } else {
      return (
        <div className={contextMenuItem}>
          <a
            href="#"
            rel="noreferrer noopener"
            className={contextMenuItemLink}
            onClick={handleDeleteTrafficRouting}
            data-test="delete-traffic-routing"
          >
            Delete Traffic Routing
          </a>
        </div>
      );
    }
  };

  const renderWizardsItems = (): React.ReactNode | null => {
    if (isServiceDetailsLoading) {
      return (
        <>
          <hr className={hrStyle} />
          <div className={contextMenuSubTitle}>Actions</div>
          <div className={contextMenuItem}>
            <Spinner size="md" aria-label={t('Loading actions...')} />
          </div>
        </>
      );
    }

    if (serviceDetails) {
      return (
        <>
          <hr className={hrStyle} />
          <div className={contextMenuSubTitle}>{updateLabel === '' ? t('Create') : t('Update')}</div>
          {SERVICE_WIZARD_ACTIONS.map(eventKey => renderWizardActionItem(eventKey))}
          <hr className={hrStyle} />
          {renderDeleteTrafficRoutingItem()}
        </>
      );
    }

    return null;
  };

  if (props.isInaccessible) {
    props.contextMenu.disable();
    return null;
  }

  // render()
  if (props.isHover) {
    return <div className={contextMenu}>{renderHeader()}</div>;
  }

  const linkParams = getLinkParamsForNode(props);
  // Disable context menu if we are dealing with an aggregate (currently has no detail)
  if (!linkParams) {
    props.contextMenu.disable();
    return null;
  }

  // The getOptionsFromLinkParams function can potentially return a blank list if the
  // node associated to the context menu is for a remote cluster with no accessible Kialis.
  // That would lead to an empty menu. Here, we assume that whoever is the host/parent component,
  // that component won't render this context menu in case this menu would be blank. So, here
  // it's simply assumed that the context menu will look good.
  const options: ContextMenuOption[] = getOptionsFromLinkParams(linkParams, props.tracingInfo);
  const menuOptions = (
    <>
      <div className={contextMenuSubTitle}>{t('Show')}</div>
      {options.map(o => createMenuItem(o.url, o.text, o.target, o.external))}
    </>
  );

  return (
    <div className={contextMenu} data-test="graph-node-context-menu">
      {renderHeader()}
      <hr className={hrStyle} />
      {menuOptions}
      {renderWizardsItems()}
    </div>
  );
};

const getTracingURL = (namespace: string, namespaceSelector: boolean, tracingURL: string, name?: string): string => {
  return `${tracingURL}/search?service=${name}${namespaceSelector ? `.${namespace}` : ''}`;
};

export type ContextMenuOption = {
  external?: boolean;
  target?: string;
  text: string;
  url: string;
};

export const clickHandler = (o: ContextMenuOption, kiosk: string): void => {
  if (o.external) {
    window.open(o.url, o.target);
  } else {
    if (isParentKiosk(kiosk)) {
      kioskContextMenuAction(o.url);
    } else {
      router.navigate(o.url);
    }
  }
};

export const getOptions = (node: DecoratedGraphNodeData, tracingInfo?: TracingInfo): ContextMenuOption[] => {
  if (node.isInaccessible) {
    return [];
  }

  const linkParams = getLinkParamsForNode(node);

  if (!linkParams) {
    return [];
  }

  return getOptionsFromLinkParams(linkParams, tracingInfo);
};

const getOptionsFromLinkParams = (linkParams: LinkParams, tracingInfo?: TracingInfo): ContextMenuOption[] => {
  const { namespace, type, name, cluster } = linkParams;

  let options: ContextMenuOption[] = [];
  let detailsPageUrl = `/namespaces/${namespace}/${type}/${name}`;
  let concat = '?';

  if (cluster && isMultiCluster) {
    detailsPageUrl += `?clusterName=${cluster}`;
    concat = '&';
  }

  options.push({ text: 'Details', url: detailsPageUrl });

  if (type !== Paths.SERVICEENTRIES) {
    options.push({ text: 'Traffic', url: `${detailsPageUrl}${concat}tab=traffic` });

    if (type === Paths.WORKLOADS) {
      options.push({ text: 'Logs', url: `${detailsPageUrl}${concat}tab=logs` });
    }

    options.push({
      text: 'Inbound Metrics',
      url: `${detailsPageUrl}${concat}tab=${type === Paths.SERVICES ? 'metrics' : 'in_metrics'}`
    });

    if (type !== Paths.SERVICES) {
      options.push({ text: 'Outbound Metrics', url: `${detailsPageUrl}${concat}tab=out_metrics` });
    }

    if (type === Paths.APPLICATIONS && tracingInfo && tracingInfo.enabled) {
      if (tracingInfo.integration) {
        options.push({ text: 'Traces', url: `${detailsPageUrl}${concat}tab=traces` });
      } else if (tracingInfo.url) {
        options.push({
          text: 'Show Traces',
          url: getTracingURL(namespace, tracingInfo.namespaceSelector, tracingInfo.url, name),
          external: true,
          target: '_blank'
        });
      }
    }
  }

  return options;
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  updateTime: state.graph.updateTime,
  tracingInfo: state.tracingState.info,
  kiosk: state.globalState.kiosk
});

export const NodeContextMenu = connect(mapStateToProps)(NodeContextMenuComponent);
