import * as React from "react";
import { DropdownGroup, DropdownItem, DropdownSeparator, Tooltip, TooltipPosition } from "@patternfly/react-core";
import {serverConfig} from "config";
import { DestinationRule, VirtualService } from "types/IstioObjects";
import { ResourcePermissions } from "types/Permissions";
import { KIALI_WIZARD_LABEL, SERVICE_WIZARD_ACTIONS, WIZARD_TITLES, WizardAction, WizardMode } from "./WizardActions";

export const DELETE_TRAFFIC_ROUTING = 'delete_traffic_routing';

type Props = {
  isDisabled?: boolean;
  destinationRules: DestinationRule[];
  virtualServices: VirtualService[];
  istioPermissions: ResourcePermissions;
  onAction?: (key: WizardAction, mode: WizardMode) => void;
  onDelete?: (key: string) => void;
}

const ServiceWizardActionsDropdownGroup: React.FunctionComponent<Props> = props => {
  const updateLabel = props.virtualServices.length === 1 &&
    props.virtualServices[0].metadata.labels &&
    props.virtualServices[0].metadata.labels[KIALI_WIZARD_LABEL]
      ? props.virtualServices[0].metadata.labels[KIALI_WIZARD_LABEL]
      : '';

  function canDelete() {
    return props.istioPermissions.delete && !serverConfig.deployment.viewOnlyMode;
  }

  function hasTrafficRouting() {
    return props.virtualServices.length > 0 || props.destinationRules.length > 0;
  }

  function handleActionClick(eventKey: string) {
    if (props.onAction) {
      props.onAction(eventKey as WizardAction, updateLabel.length === 0 ? 'create' : 'update');
    }
  }

  function getDropdownItemTooltipMessage(): string {
    if (serverConfig.deployment.viewOnlyMode) {
      return 'User does not have permission';
    } else if (hasTrafficRouting()) {
      return 'Traffic routing already exists for this service';
    } else {
      return "Traffic routing doesn't exists for this service";
    }
  }

  const actionItems = SERVICE_WIZARD_ACTIONS.map(eventKey => {
    const enabledItem = props.isDisabled || !hasTrafficRouting() || (hasTrafficRouting() && updateLabel === eventKey);
    const wizardItem = (
      <DropdownItem key={eventKey} component="button" isDisabled={!enabledItem} onClick={() => handleActionClick(eventKey)} data-test={eventKey}>
        {WIZARD_TITLES[eventKey]}
      </DropdownItem>
    );

    // An Item is rendered under two conditions:
    // a) No traffic -> Wizard can create new one
    // b) Existing traffic generated by the traffic -> Wizard can update that scenario
    // Otherwise, the item should be disabled
    if (!enabledItem) {
      return (
        <Tooltip key={'tooltip_' + eventKey} position={TooltipPosition.left} content={<>{getDropdownItemTooltipMessage()}</>}>
          <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{wizardItem}</div>
        </Tooltip>
      )
    } else {
      return wizardItem;
    }
  });

  actionItems.push(<DropdownSeparator key="actions_separator" />);
  // TODO: Add tooltip
  actionItems.push(
    <DropdownItem
      key={DELETE_TRAFFIC_ROUTING}
      component="button"
      onClick={() => {if (props.onDelete) { props.onDelete(DELETE_TRAFFIC_ROUTING); }}}
      isDisabled={!canDelete() || !hasTrafficRouting() || props.isDisabled}
      data-test={DELETE_TRAFFIC_ROUTING}
    >
      Delete Traffic Routing
    </DropdownItem>
  );

  return (
    <DropdownGroup
      key={'group_create'}
      label={updateLabel === '' ? 'Create' : 'Update'}
      className="kiali-group-menu"
      children={actionItems}
    />
  );
}

export default ServiceWizardActionsDropdownGroup;
