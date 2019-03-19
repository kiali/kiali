import * as React from 'react';
import { DropdownButton, MenuItem, MessageDialog, OverlayTrigger, Tooltip } from 'patternfly-react';
import IstioWizard, { WIZARD_MATCHING_ROUTING, WIZARD_TITLES, WIZARD_WEIGHTED_ROUTING } from './IstioWizard';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { DestinationRules, VirtualServices } from '../../types/IstioObjects';
import * as MessageCenter from '../../utils/MessageCenter';
import * as API from '../../services/Api';
import { serverConfig } from '../../config/serverConfig';
import { TLSStatus } from '../../types/TLSStatus';

type Props = {
  namespace: string;
  serviceName: string;
  show: boolean;
  workloads: WorkloadOverview[];
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  tlsStatus?: TLSStatus;
  onChange: () => void;
};

type State = {
  showWizard: boolean;
  wizardType: string;
  showConfirmDelete: boolean;
  isDeleting: boolean;
};

const DELETE_TRAFFIC_ROUTING = 'delete_traffic_routing';

class IstioWizardDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { showWizard: props.show, wizardType: '', showConfirmDelete: false, isDeleting: false };
  }

  // Wizard can be opened when there are not existing VS & DR and there are update permissions
  canCreate = () => {
    return this.props.virtualServices.permissions.create && this.props.destinationRules.permissions.create;
  };

  canDelete = () => {
    return this.props.virtualServices.permissions.delete && this.props.destinationRules.permissions.delete;
  };

  hasTrafficRouting = () => {
    return this.props.virtualServices.items.length > 0 || this.props.destinationRules.items.length > 0;
  };

  onAction = (key: string) => {
    switch (key) {
      case WIZARD_WEIGHTED_ROUTING:
      case WIZARD_MATCHING_ROUTING: {
        this.setState({ showWizard: true, wizardType: key });
        break;
      }
      case DELETE_TRAFFIC_ROUTING: {
        this.setState({ showConfirmDelete: true });
        break;
      }
      default:
        console.log('Unrecognized key');
    }
  };

  onDelete = () => {
    this.setState({
      isDeleting: true
    });
    const deletePromises: Promise<any>[] = [];
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
    // For slow scenarios, dialog is hidden and Delete All action blocked until promises have finished
    this.hideConfirmDelete();
    Promise.all(deletePromises)
      .then(results => {
        this.setState({
          isDeleting: false
        });
        this.props.onChange();
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not delete Istio config objects', error));
        this.setState({
          isDeleting: false
        });
      });
  };

  hideConfirmDelete = () => {
    this.setState({ showConfirmDelete: false });
  };

  onClose = (changed: boolean) => {
    this.setState({ showWizard: false });
    if (changed) {
      this.props.onChange();
    }
  };

  renderMenuItem = (eventKey: string) => {
    switch (eventKey) {
      case WIZARD_WEIGHTED_ROUTING:
      case WIZARD_MATCHING_ROUTING:
        const menuItem = (
          <MenuItem disabled={this.hasTrafficRouting()} key={eventKey} eventKey={eventKey}>
            {WIZARD_TITLES[eventKey]}
          </MenuItem>
        );
        return this.hasTrafficRouting() ? (
          <OverlayTrigger
            placement={'left'}
            overlay={<Tooltip id={'mtls-status-masthead'}>Traffic routing already exists for this service</Tooltip>}
            trigger={['hover', 'focus']}
            rootClose={false}
          >
            {menuItem}
          </OverlayTrigger>
        ) : (
          menuItem
        );
      case DELETE_TRAFFIC_ROUTING:
        const deleteMenuItem = (
          <MenuItem disabled={!this.hasTrafficRouting() || this.state.isDeleting} key={eventKey} eventKey={eventKey}>
            Delete ALL Traffic Routing
          </MenuItem>
        );
        return !this.hasTrafficRouting() ? (
          <OverlayTrigger
            placement={'left'}
            overlay={<Tooltip id={'mtls-status-masthead'}>Traffic routing doesn't exist for this service</Tooltip>}
            trigger={['hover', 'focus']}
            rootClose={false}
          >
            {deleteMenuItem}
          </OverlayTrigger>
        ) : (
          deleteMenuItem
        );
      default:
        return <>Unsupported</>;
    }
  };

  render() {
    let deleteMessage = 'Are you sure you want to delete ';
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
    deleteMessage += ' ?.  ';
    return (
      <>
        <DropdownButton id="service_actions" title="Actions" onSelect={this.onAction} pullRight={true}>
          {this.canCreate() && this.renderMenuItem(WIZARD_WEIGHTED_ROUTING)}
          {this.canCreate() && this.renderMenuItem(WIZARD_MATCHING_ROUTING)}
          <MenuItem divider={true} />
          {this.canDelete() && this.renderMenuItem(DELETE_TRAFFIC_ROUTING)}
        </DropdownButton>
        <IstioWizard
          show={this.state.showWizard}
          type={this.state.wizardType}
          namespace={this.props.namespace}
          serviceName={this.props.serviceName}
          workloads={this.props.workloads.filter(workload => {
            const appLabelName = serverConfig.istioLabels.versionLabelName;
            const versionLabelName = serverConfig.istioLabels.versionLabelName;
            return workload.labels && workload.labels[appLabelName] && workload.labels[versionLabelName];
          })}
          tlsStatus={this.props.tlsStatus}
          onClose={this.onClose}
        />
        <MessageDialog
          show={this.state.showConfirmDelete}
          primaryAction={this.onDelete}
          secondaryAction={this.hideConfirmDelete}
          onHide={this.hideConfirmDelete}
          primaryActionButtonContent="Delete"
          secondaryActionButtonContent="Cancel"
          primaryActionButtonBsStyle="danger"
          title="Confirm Delete"
          primaryContent={deleteMessage}
          secondaryContent="It cannot be undone. Make sure this is something you really want to do!"
          accessibleName="deleteConfirmationDialog"
          accessibleDescription="deleteConfirmationDialogContent"
        />
      </>
    );
  }
}

export default IstioWizardDropdown;
