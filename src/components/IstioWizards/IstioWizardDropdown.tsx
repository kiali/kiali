import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownToggle,
  DropdownItem,
  DropdownPosition,
  DropdownSeparator,
  Modal,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { CaretDownIcon } from '@patternfly/react-icons';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { DestinationRules, VirtualServices } from '../../types/IstioObjects';
import * as MessageCenter from '../../utils/MessageCenter';
import * as API from '../../services/Api';
import { serverConfig } from '../../config/ServerConfig';
import { TLSStatus } from '../../types/TLSStatus';
import {
  KIALI_WIZARD_LABEL,
  WIZARD_ACTIONS,
  WIZARD_MATCHING_ROUTING,
  WIZARD_SUSPEND_TRAFFIC,
  WIZARD_THREESCALE_INTEGRATION,
  WIZARD_TITLES,
  WIZARD_UPDATE_TITLES,
  WIZARD_WEIGHTED_ROUTING
} from './IstioWizardActions';
import IstioWizard from './IstioWizard';
import { ThreeScaleInfo, ThreeScaleServiceRule } from '../../types/ThreeScale';

type Props = {
  namespace: string;
  serviceName: string;
  show: boolean;
  workloads: WorkloadOverview[];
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  gateways: string[];
  tlsStatus?: TLSStatus;
  threeScaleInfo: ThreeScaleInfo;
  threeScaleServiceRule?: ThreeScaleServiceRule;
  onChange: () => void;
};

type State = {
  showWizard: boolean;
  updateWizard: boolean;
  wizardType: string;
  showConfirmDelete: boolean;
  deleteAction: string;
  isDeleting: boolean;
  isActionsOpen: boolean;
};

const DELETE_TRAFFIC_ROUTING = 'delete_traffic_routing';
const DELETE_THREESCALE_INTEGRATION = 'delete_threescale_integration';

class IstioWizardDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showWizard: props.show,
      wizardType: '',
      showConfirmDelete: false,
      deleteAction: '',
      isDeleting: false,
      updateWizard: false,
      isActionsOpen: false
    };
  }

  private appLabelName = serverConfig.istioLabels.appLabelName;
  private versionLabelName = serverConfig.istioLabels.versionLabelName;

  // Wizard can be opened when there are not existing VS & DR and there are update permissions
  canCreate = () => {
    return this.props.virtualServices.permissions.create && this.props.destinationRules.permissions.create;
  };

  canUpdate = () => {
    return this.props.virtualServices.permissions.update && this.props.destinationRules.permissions.update;
  };

  canDelete = () => {
    return this.props.virtualServices.permissions.delete && this.props.destinationRules.permissions.delete;
  };

  hasTrafficRouting = () => {
    return this.props.virtualServices.items.length > 0 || this.props.destinationRules.items.length > 0;
  };

  hasSidecarWorkloads = (): boolean => {
    let hasSidecarWorkloads = false;
    for (let i = 0; i < this.props.workloads.length; i++) {
      if (this.props.workloads[i].istioSidecar) {
        // At least one workload with sidecar
        hasSidecarWorkloads = true;
        break;
      }
    }
    return hasSidecarWorkloads;
  };

  hideConfirmDelete = () => {
    this.setState({ showConfirmDelete: false });
  };

  getDeleteMessage = () => {
    let deleteMessage = 'Are you sure you want to delete ';
    switch (this.state.deleteAction) {
      case DELETE_TRAFFIC_ROUTING:
        deleteMessage +=
          this.props.virtualServices.items.length > 0
            ? `VirtualService${
                this.props.virtualServices.items.length > 1 ? 's' : ''
              }: '${this.props.virtualServices.items.map(vs => vs.metadata.name)}'`
            : '';
        deleteMessage +=
          this.props.virtualServices.items.length > 0 && this.props.destinationRules.items.length > 0 ? ' and ' : '';
        deleteMessage +=
          this.props.destinationRules.items.length > 0
            ? `DestinationRule${
                this.props.destinationRules.items.length > 1 ? 's' : ''
              }: '${this.props.destinationRules.items.map(dr => dr.metadata.name)}'`
            : '';
        break;
      case DELETE_THREESCALE_INTEGRATION:
        deleteMessage += ' 3scale API Management Integration Rule ';
        break;
      default:
    }
    deleteMessage += ' ?  ';
    return deleteMessage;
  };

  getValidWorkloads = (): WorkloadOverview[] => {
    return this.props.workloads.filter(workload => {
      return workload.labels && workload.labels[this.appLabelName] && workload.labels[this.versionLabelName];
    });
  };

  getVSWizardLabel = () => {
    return this.props.virtualServices.items.length === 1 &&
      this.props.virtualServices.items[0].metadata.labels &&
      this.props.virtualServices.items[0].metadata.labels[KIALI_WIZARD_LABEL]
      ? this.props.virtualServices.items[0].metadata.labels[KIALI_WIZARD_LABEL]
      : '';
  };

  onAction = (key: string) => {
    const updateLabel = this.getVSWizardLabel();
    switch (key) {
      case WIZARD_WEIGHTED_ROUTING:
      case WIZARD_MATCHING_ROUTING:
      case WIZARD_SUSPEND_TRAFFIC: {
        this.setState({ showWizard: true, wizardType: key, updateWizard: key === updateLabel });
        break;
      }
      case WIZARD_THREESCALE_INTEGRATION: {
        this.setState({
          showWizard: true,
          wizardType: key,
          updateWizard: this.props.threeScaleServiceRule !== undefined
        });
        break;
      }
      case DELETE_TRAFFIC_ROUTING: {
        this.setState({ showConfirmDelete: true, deleteAction: key });
        break;
      }
      case DELETE_THREESCALE_INTEGRATION: {
        this.setState({ showConfirmDelete: true, deleteAction: key });
        break;
      }
      default:
        console.log('Unrecognized key');
    }
  };

  onActionsSelect = () => {
    this.setState({
      isActionsOpen: !this.state.isActionsOpen
    });
  };

  onActionsToggle = (isOpen: boolean) => {
    this.setState({
      isActionsOpen: isOpen
    });
  };

  onClose = (changed: boolean) => {
    this.setState({ showWizard: false });
    if (changed) {
      this.props.onChange();
    }
  };

  onDelete = () => {
    this.setState({
      isDeleting: true
    });
    const deletePromises: Promise<any>[] = [];
    switch (this.state.deleteAction) {
      case DELETE_TRAFFIC_ROUTING:
        this.props.virtualServices.items.forEach(vs => {
          deletePromises.push(
            API.deleteIstioConfigDetail(vs.metadata.namespace || '', 'virtualservices', vs.metadata.name)
          );
        });
        this.props.destinationRules.items.forEach(dr => {
          deletePromises.push(
            API.deleteIstioConfigDetail(dr.metadata.namespace || '', 'destinationrules', dr.metadata.name)
          );
        });
        break;
      case DELETE_THREESCALE_INTEGRATION:
        deletePromises.push(API.deleteThreeScaleServiceRule(this.props.namespace, this.props.serviceName));
        break;
      default:
    }
    // For slow scenarios, dialog is hidden and Delete All action blocked until promises have finished
    this.hideConfirmDelete();
    Promise.all(deletePromises)
      .then(_results => {
        this.setState({
          isDeleting: false
        });
        this.props.onChange();
      })
      .catch(error => {
        MessageCenter.addError('Could not delete Istio config objects.', error);
        this.setState({
          isDeleting: false
        });
      });
  };

  renderTooltip = (key, position, msg, child): any => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{child}</div>
      </Tooltip>
    );
  };

  renderDropdownItem = (eventKey: string, updateLabel: string) => {
    switch (eventKey) {
      case WIZARD_WEIGHTED_ROUTING:
      case WIZARD_MATCHING_ROUTING:
      case WIZARD_SUSPEND_TRAFFIC:
        // An Item is rendered under two conditions:
        // a) No traffic -> Wizard can create new one
        // b) Existing traffic generated by the traffic -> Wizard can update that scenario
        // Otherwise, the item should be disabled
        const enabledItem = !this.hasTrafficRouting() || (this.hasTrafficRouting() && updateLabel === eventKey);
        const wizardItem = (
          <DropdownItem
            key={eventKey}
            component="button"
            isDisabled={!enabledItem}
            onClick={() => this.onAction(eventKey)}
          >
            {updateLabel === eventKey ? WIZARD_UPDATE_TITLES[eventKey] : WIZARD_TITLES[eventKey]}
          </DropdownItem>
        );
        return !enabledItem
          ? this.renderTooltip(
              eventKey,
              TooltipPosition.left,
              'Traffic routing already exists for this service',
              wizardItem
            )
          : wizardItem;
      case DELETE_TRAFFIC_ROUTING:
        const deleteItem = (
          <DropdownItem
            key={eventKey}
            component="button"
            onClick={() => this.onAction(eventKey)}
            isDisabled={!this.hasTrafficRouting() || this.state.isDeleting}
          >
            Delete ALL Traffic Routing
          </DropdownItem>
        );
        return !this.hasTrafficRouting()
          ? this.renderTooltip(
              eventKey,
              TooltipPosition.left,
              "Traffic routing doesn't exist for this service",
              deleteItem
            )
          : deleteItem;
      case WIZARD_THREESCALE_INTEGRATION:
        const threeScaleEnabledItem =
          !this.props.threeScaleServiceRule || (this.props.threeScaleServiceRule && updateLabel === eventKey);
        const threeScaleItem = (
          <DropdownItem
            key={eventKey}
            component="button"
            onClick={() => this.onAction(eventKey)}
            isDisabled={!threeScaleEnabledItem}
          >
            {updateLabel === eventKey ? WIZARD_UPDATE_TITLES[eventKey] : WIZARD_TITLES[eventKey]}
          </DropdownItem>
        );
        const toolTipMsgExists = '3scale API Integration Rule already exists for this service';
        return !threeScaleEnabledItem
          ? this.renderTooltip(eventKey, TooltipPosition.left, toolTipMsgExists, threeScaleItem)
          : threeScaleItem;
      case DELETE_THREESCALE_INTEGRATION:
        const deleteThreeScaleItem = (
          <DropdownItem
            key={eventKey}
            component="button"
            onClick={() => this.onAction(eventKey)}
            isDisabled={!this.props.threeScaleServiceRule || this.state.isDeleting}
          >
            Delete 3Scale API Management Rule
          </DropdownItem>
        );
        return deleteThreeScaleItem;
      default:
        return <>Unsupported</>;
    }
  };

  renderDropdownItems = () => {
    var items: any[] = [];
    const updateLabel = this.getVSWizardLabel();
    if (this.canCreate() || this.canUpdate()) {
      items = items.concat(WIZARD_ACTIONS.map(action => this.renderDropdownItem(action, updateLabel)));
    }
    items.push(<DropdownSeparator key="actions_separator" />);
    if (this.canDelete()) {
      items.push(this.renderDropdownItem(DELETE_TRAFFIC_ROUTING, ''));
    }
    if (this.props.threeScaleInfo.enabled) {
      items = items.concat([
        <DropdownSeparator key="threescale_separator" />,
        this.renderDropdownItem(
          WIZARD_THREESCALE_INTEGRATION,
          this.props.threeScaleServiceRule ? WIZARD_THREESCALE_INTEGRATION : ''
        ),
        this.renderDropdownItem(DELETE_THREESCALE_INTEGRATION, '')
      ]);
    }
    return items;
  };

  render() {
    const hasActionRights = this.canCreate() || this.canUpdate() || this.canDelete();
    const hasSidecarWorkloads = this.hasSidecarWorkloads();
    const toolTipMsgActions = !hasActionRights
      ? 'User has not permissions on this Service'
      : !hasSidecarWorkloads
      ? 'There are not Workloads with sidecar for this service'
      : 'There are not Workloads with ' + this.appLabelName + ' and ' + this.versionLabelName + ' labels';
    const validWorkloads = this.getValidWorkloads();
    const validActions = hasActionRights && hasSidecarWorkloads && validWorkloads;

    const dropdown = (
      <Dropdown
        position={DropdownPosition.right}
        onSelect={this.onActionsSelect}
        toggle={
          <DropdownToggle onToggle={this.onActionsToggle} iconComponent={CaretDownIcon}>
            Actions
          </DropdownToggle>
        }
        isOpen={this.state.isActionsOpen}
        dropdownItems={this.renderDropdownItems()}
        disabled={!validActions}
        style={{ pointerEvents: validActions ? 'auto' : 'none' }}
      />
    );
    return (
      <>
        {!hasActionRights || !hasSidecarWorkloads
          ? this.renderTooltip('tooltip_wizard_actions', TooltipPosition.top, toolTipMsgActions, dropdown)
          : dropdown}
        <IstioWizard
          show={this.state.showWizard}
          type={this.state.wizardType}
          update={this.state.updateWizard}
          namespace={this.props.namespace}
          serviceName={this.props.serviceName}
          workloads={validWorkloads}
          virtualServices={this.props.virtualServices}
          destinationRules={this.props.destinationRules}
          gateways={this.props.gateways}
          threeScaleServiceRule={this.props.threeScaleServiceRule}
          tlsStatus={this.props.tlsStatus}
          onClose={this.onClose}
        />
        <Modal
          isSmall={true}
          title="Confirm Delete ?"
          isOpen={this.state.showConfirmDelete}
          onClose={this.hideConfirmDelete}
          actions={[
            <Button key="cancel" variant="secondary" onClick={this.hideConfirmDelete}>
              Cancel
            </Button>,
            <Button key="confirm" variant="danger" onClick={this.onDelete}>
              Delete
            </Button>
          ]}
        >
          {this.getDeleteMessage()}
        </Modal>
      </>
    );
  }
}

export default IstioWizardDropdown;
