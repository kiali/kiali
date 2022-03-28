import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownPosition,
  DropdownSeparator,
  DropdownToggle,
  Modal,
  ModalVariant,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { CaretDownIcon } from '@patternfly/react-icons';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { DestinationRule, PeerAuthentication, VirtualService } from '../../types/IstioObjects';
import * as AlertUtils from '../../utils/AlertUtils';
import * as API from '../../services/Api';
import { serverConfig } from '../../config/ServerConfig';
import { TLSStatus } from '../../types/TLSStatus';
import {
  KIALI_RELATED_LABEL,
  KIALI_WIZARD_LABEL,
  SERVICE_WIZARD_ACTIONS,
  WIZARD_REQUEST_ROUTING,
  WIZARD_FAULT_INJECTION,
  WIZARD_TITLES,
  WIZARD_TRAFFIC_SHIFTING,
  WIZARD_REQUEST_TIMEOUTS,
  WIZARD_TCP_TRAFFIC_SHIFTING
} from './WizardActions';
import ServiceWizard from './ServiceWizard';
import { ResourcePermissions } from '../../types/Permissions';

type Props = {
  namespace: string;
  serviceName: string;
  show: boolean;
  workloads: WorkloadOverview[];
  virtualServices: VirtualService[];
  destinationRules: DestinationRule[];
  istioPermissions: ResourcePermissions;
  gateways: string[];
  peerAuthentications: PeerAuthentication[];
  tlsStatus?: TLSStatus;
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

class ServiceWizardDropdown extends React.Component<Props, State> {
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
    return (
      this.props.istioPermissions.create && this.props.istioPermissions.create && !serverConfig.deployment.viewOnlyMode
    );
  };

  canUpdate = () => {
    return (
      this.props.istioPermissions.update && this.props.istioPermissions.update && !serverConfig.deployment.viewOnlyMode
    );
  };

  canDelete = () => {
    return (
      this.props.istioPermissions.delete && this.props.istioPermissions.delete && !serverConfig.deployment.viewOnlyMode
    );
  };

  hasTrafficRouting = () => {
    return this.props.virtualServices.length > 0 || this.props.destinationRules.length > 0;
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
    const deleteMessage = 'Are you sure you want to delete ?';
    const deleteItems: JSX.Element[] = [];
    switch (this.state.deleteAction) {
      case DELETE_TRAFFIC_ROUTING:
        let vsMessage =
          this.props.virtualServices.length > 0
            ? `VirtualService${this.props.virtualServices.length > 1 ? 's' : ''}: '${this.props.virtualServices.map(
                vs => vs.metadata.name
              )}'`
            : '';
        deleteItems.push(<div>{vsMessage}</div>);

        let drMessage =
          this.props.destinationRules.length > 0
            ? `DestinationRule${this.props.destinationRules.length > 1 ? 's' : ''}: '${this.props.destinationRules.map(
                dr => dr.metadata.name
              )}'`
            : '';
        deleteItems.push(<div>{drMessage}</div>);

        let paMessage =
          this.props.destinationRules.length > 0 && this.hasAnyPeerAuthn(this.props.destinationRules)
            ? `PeerAuthentication${
                this.props.destinationRules.length > 1 ? 's' : ''
              }: '${this.props.destinationRules.map(dr => dr.metadata.name)}'`
            : '';
        deleteItems.push(<div>{paMessage}</div>);

        break;
      default:
    }
    return (
      <>
        <div style={{ marginBottom: 5 }}>{deleteMessage}</div>
        {deleteItems}
      </>
    );
  };

  hasAnyPeerAuthn = (drs: DestinationRule[]): boolean => {
    return drs.filter(dr => !!this.hasPeerAuthentication(dr)).length > 0;
  };

  hasPeerAuthentication = (dr: DestinationRule): string => {
    if (!!dr.metadata && !!dr.metadata.annotations && dr.metadata.annotations[KIALI_RELATED_LABEL] !== undefined) {
      const anno = dr.metadata.annotations[KIALI_RELATED_LABEL];
      const parts = anno.split('/');
      if (parts.length > 1) {
        return parts[1];
      }
    }
    return '';
  };

  getValidWorkloads = (): WorkloadOverview[] => {
    return this.props.workloads.filter(workload => {
      // A workload could skip the version label on this check only when there is a single workload list
      return (
        workload.labels &&
        workload.labels[this.appLabelName] &&
        (workload.labels[this.versionLabelName] || this.props.workloads.length === 1)
      );
    });
  };

  getVSWizardLabel = () => {
    return this.props.virtualServices.length === 1 &&
      this.props.virtualServices[0].metadata.labels &&
      this.props.virtualServices[0].metadata.labels[KIALI_WIZARD_LABEL]
      ? this.props.virtualServices[0].metadata.labels[KIALI_WIZARD_LABEL]
      : '';
  };

  onAction = (key: string) => {
    const updateLabel = this.getVSWizardLabel();
    switch (key) {
      case WIZARD_REQUEST_ROUTING:
      case WIZARD_FAULT_INJECTION:
      case WIZARD_TRAFFIC_SHIFTING:
      case WIZARD_TCP_TRAFFIC_SHIFTING:
      case WIZARD_REQUEST_TIMEOUTS: {
        this.setState({ showWizard: true, wizardType: key, updateWizard: key === updateLabel });
        break;
      }
      case DELETE_TRAFFIC_ROUTING: {
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
        this.props.virtualServices.forEach(vs => {
          deletePromises.push(
            API.deleteIstioConfigDetail(vs.metadata.namespace || '', 'virtualservices', vs.metadata.name)
          );
        });
        this.props.destinationRules.forEach(dr => {
          deletePromises.push(
            API.deleteIstioConfigDetail(dr.metadata.namespace || '', 'destinationrules', dr.metadata.name)
          );

          const paName = this.hasPeerAuthentication(dr);
          if (!!paName) {
            deletePromises.push(
              API.deleteIstioConfigDetail(dr.metadata.namespace || '', 'peerauthentications', paName)
            );
          }
        });

        break;
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
        AlertUtils.addError('Could not delete Istio config objects.', error);
        this.setState({
          isDeleting: false
        });
      });
  };

  renderTooltip = (key, position, msg, child): JSX.Element => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed' }}>{child}</div>
      </Tooltip>
    );
  };

  getDropdownItemTooltipMessage = (): string => {
    if (serverConfig.deployment.viewOnlyMode) {
      return 'User does not have permission';
    } else if (this.hasTrafficRouting()) {
      return 'Traffic routing already exists for this service';
    } else {
      return "Traffic routing doesn't exists for this service";
    }
  };

  renderDropdownItem = (eventKey: string, updateLabel: string) => {
    switch (eventKey) {
      case WIZARD_REQUEST_ROUTING:
      case WIZARD_FAULT_INJECTION:
      case WIZARD_TRAFFIC_SHIFTING:
      case WIZARD_TCP_TRAFFIC_SHIFTING:
      case WIZARD_REQUEST_TIMEOUTS:
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
            {WIZARD_TITLES[eventKey]}
          </DropdownItem>
        );
        return !enabledItem
          ? this.renderTooltip(eventKey, TooltipPosition.left, this.getDropdownItemTooltipMessage(), wizardItem)
          : wizardItem;
      case DELETE_TRAFFIC_ROUTING:
        const deleteItem = (
          <DropdownItem
            key={eventKey}
            component="button"
            onClick={() => this.onAction(eventKey)}
            isDisabled={!this.canDelete() || !this.hasTrafficRouting() || this.state.isDeleting}
          >
            Delete Traffic Routing
          </DropdownItem>
        );
        return !this.hasTrafficRouting()
          ? this.renderTooltip(eventKey, TooltipPosition.left, this.getDropdownItemTooltipMessage(), deleteItem)
          : deleteItem;
      default:
        return <>Unsupported</>;
    }
  };

  renderDropdownItems = () => {
    var items: any[] = [];
    const updateLabel = this.getVSWizardLabel();
    items = [
      <DropdownGroup
        key={'group_create'}
        label={updateLabel === '' ? 'Create' : 'Update'}
        className="kiali-group-menu"
        children={SERVICE_WIZARD_ACTIONS.map(action => this.renderDropdownItem(action, updateLabel))}
      />
    ];
    items.push(<DropdownSeparator key="actions_separator" />);
    items.push(this.renderDropdownItem(DELETE_TRAFFIC_ROUTING, ''));
    return items;
  };

  render() {
    const hasSidecarWorkloads = this.hasSidecarWorkloads();
    const toolTipMsgActions = !hasSidecarWorkloads
      ? 'There are not Workloads with sidecar for this service'
      : 'There are not Workloads with ' + this.appLabelName + ' and ' + this.versionLabelName + ' labels';
    const validWorkloads = this.getValidWorkloads();
    const validActions = hasSidecarWorkloads && validWorkloads;

    const dropdown = (
      <Dropdown
        position={DropdownPosition.right}
        onSelect={this.onActionsSelect}
        toggle={
          <DropdownToggle onToggle={this.onActionsToggle} icon={CaretDownIcon}>
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
        {!hasSidecarWorkloads
          ? this.renderTooltip('tooltip_wizard_actions', TooltipPosition.top, toolTipMsgActions, dropdown)
          : dropdown}
        <ServiceWizard
          show={this.state.showWizard}
          type={this.state.wizardType}
          update={this.state.updateWizard}
          namespace={this.props.namespace}
          serviceName={this.props.serviceName}
          workloads={validWorkloads}
          createOrUpdate={this.canCreate() || this.canUpdate()}
          virtualServices={this.props.virtualServices}
          destinationRules={this.props.destinationRules}
          gateways={this.props.gateways}
          peerAuthentications={this.props.peerAuthentications}
          tlsStatus={this.props.tlsStatus}
          onClose={this.onClose}
        />
        <Modal
          variant={ModalVariant.small}
          title="Confirm Delete Traffic Routing ?"
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

export default ServiceWizardDropdown;
