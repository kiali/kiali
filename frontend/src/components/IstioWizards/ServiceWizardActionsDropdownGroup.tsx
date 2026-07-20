import * as React from 'react';
import { DropdownGroup, DropdownItem, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { serverConfig } from 'config';
import type { DestinationRule, K8sHTTPRoute, K8sGRPCRoute, VirtualService } from 'types/IstioObjects';
import { getWizardUpdateLabel } from 'types/IstioObjects';
import type { ResourcePermissions } from 'types/Permissions';
import { canDelete } from 'types/Permissions';
import type { WizardAction, WizardMode } from './WizardActions';
import {
  SERVICE_WIZARD_ACTIONS,
  WIZARD_K8S_REQUEST_ROUTING,
  WIZARD_K8S_GRPC_REQUEST_ROUTING,
  WIZARD_TITLES,
  WIZARD_REQUEST_ROUTING,
  WIZARD_FAULT_INJECTION,
  WIZARD_TRAFFIC_SHIFTING,
  WIZARD_REQUEST_TIMEOUTS,
  WIZARD_TCP_TRAFFIC_SHIFTING
} from './WizardActions';
import { hasServiceDetailsTrafficRouting } from '../../types/ServiceInfo';
import { groupMenuStyle, titleStyle } from 'styles/DropdownStyles';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

export const DELETE_TRAFFIC_ROUTING = 'delete_traffic_routing';

type Props = {
  className?: string;
  destinationRules: DestinationRule[];
  isDisabled?: boolean;
  istioPermissions: ResourcePermissions;
  k8sGRPCRoutes: K8sGRPCRoute[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  onAction?: (key: WizardAction, mode: WizardMode) => void;
  onDelete?: (key: string) => void;
  virtualServices: VirtualService[];
};

const optionDisabledStyle = kialiStyle({
  cursor: 'not-allowed',
  $nest: {
    '& button': {
      pointerEvents: 'none'
    }
  }
});

export const ServiceWizardActionsDropdownGroup: React.FunctionComponent<Props> = (props: Props) => {
  const updateLabel = getWizardUpdateLabel(props.virtualServices, props.k8sHTTPRoutes, props.k8sGRPCRoutes);
  const isViewOnly = serverConfig.deployment.viewOnlyMode;
  // Topology context menus unmount on pointerdown (before click). Fire once from
  // mousedown/click so Create/Delete actions still run when the menu closes.
  const lastTriggerRef = React.useRef(0);

  const hasTrafficRouting = (): boolean => {
    return hasServiceDetailsTrafficRouting(
      props.virtualServices,
      props.destinationRules,
      props.k8sHTTPRoutes,
      props.k8sGRPCRoutes
    );
  };

  const handleActionClick = (eventKey: string): void => {
    if (props.onAction) {
      props.onAction(eventKey as WizardAction, updateLabel.length === 0 ? 'create' : 'update');
    }
  };

  const triggerAction = (eventKey: string): void => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 400) {
      return;
    }
    lastTriggerRef.current = now;
    handleActionClick(eventKey);
  };

  const triggerDelete = (): void => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 400) {
      return;
    }
    lastTriggerRef.current = now;
    if (props.onDelete) {
      props.onDelete(DELETE_TRAFFIC_ROUTING);
    }
  };

  const getDropdownItemTooltipMessage = (isGatewayAPI: boolean, hasExistingTrafficRouting: boolean): string => {
    if (isViewOnly && !hasExistingTrafficRouting) {
      return t('There is no traffic routing to view for this service');
    } else if (isViewOnly) {
      return t('No user permission or Kiali in view-only mode');
    } else if (hasExistingTrafficRouting) {
      return t('Traffic routing already exists for this service');
    } else if (isGatewayAPI) {
      return t('K8s Gateway API is not enabled');
    } else {
      return t("Traffic routing doesn't exists for this service");
    }
  };

  const actionItems = SERVICE_WIZARD_ACTIONS.map(eventKey => {
    const isGatewayAPIEnabled =
      eventKey === WIZARD_K8S_REQUEST_ROUTING || eventKey === WIZARD_K8S_GRPC_REQUEST_ROUTING
        ? serverConfig.gatewayAPIEnabled
        : true;
    const hasExistingTrafficRouting = hasTrafficRouting();

    const istioWizardKeys = [
      WIZARD_REQUEST_ROUTING,
      WIZARD_FAULT_INJECTION,
      WIZARD_TRAFFIC_SHIFTING,
      WIZARD_REQUEST_TIMEOUTS,
      WIZARD_TCP_TRAFFIC_SHIFTING
    ];

    const isIstioAPIInstalled = istioWizardKeys.includes(eventKey) ? serverConfig.istioAPIInstalled : true;

    const enabledItem =
      isGatewayAPIEnabled &&
      isIstioAPIInstalled &&
      !props.isDisabled &&
      (isViewOnly
        ? hasExistingTrafficRouting && updateLabel === eventKey
        : !hasExistingTrafficRouting || updateLabel === eventKey);

    const wizardItem = (
      <DropdownItem
        className={props.className}
        key={eventKey}
        component="button"
        isDisabled={!enabledItem}
        onMouseDown={(e: React.MouseEvent): void => {
          if (e.button === 0 && enabledItem) {
            e.preventDefault();
            e.stopPropagation();
            triggerAction(eventKey);
          }
        }}
        onClick={(e: React.MouseEvent): void => {
          e.preventDefault();
          e.stopPropagation();
          if (enabledItem) {
            triggerAction(eventKey);
          }
        }}
        data-test={eventKey}
      >
        {t(WIZARD_TITLES[eventKey].title)}
      </DropdownItem>
    );

    // An Item is rendered under two conditions:
    // a) No traffic -> Wizard can create new one
    // b) Existing traffic generated by the traffic -> Wizard can update that scenario
    // Otherwise, the item should be disabled
    if (!enabledItem) {
      return (
        <Tooltip
          key={`tooltip_${eventKey}`}
          position={TooltipPosition.left}
          content={<>{getDropdownItemTooltipMessage(!isGatewayAPIEnabled, hasExistingTrafficRouting)}</>}
        >
          <div className={optionDisabledStyle}>{wizardItem}</div>
        </Tooltip>
      );
    } else {
      return wizardItem;
    }
  });

  const deleteDisabled = !canDelete(props.istioPermissions) || !hasTrafficRouting() || props.isDisabled;

  let deleteDropdownItem = (
    <DropdownItem
      key={DELETE_TRAFFIC_ROUTING}
      component="button"
      onMouseDown={(e: React.MouseEvent): void => {
        if (e.button === 0 && !deleteDisabled) {
          e.preventDefault();
          e.stopPropagation();
          triggerDelete();
        }
      }}
      onClick={(e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        if (!deleteDisabled) {
          triggerDelete();
        }
      }}
      isDisabled={deleteDisabled}
      data-test={DELETE_TRAFFIC_ROUTING}
    >
      {t('Delete Traffic Routing')}
    </DropdownItem>
  );

  if (deleteDisabled) {
    deleteDropdownItem = (
      <Tooltip
        key={`tooltip_${DELETE_TRAFFIC_ROUTING}`}
        position={TooltipPosition.left}
        content={<>{getDropdownItemTooltipMessage(false, hasTrafficRouting())}</>}
      >
        <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{deleteDropdownItem}</div>
      </Tooltip>
    );
  }

  actionItems.push(deleteDropdownItem);

  const label = isViewOnly ? t('View') : updateLabel === '' ? t('Create') : t('Update');

  return (
    <>
      <div className={titleStyle}>{label}</div>
      <DropdownGroup key={`group_${label}`} className={groupMenuStyle} children={actionItems} />
    </>
  );
};
