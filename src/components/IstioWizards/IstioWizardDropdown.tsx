import * as React from 'react';
import { DropdownButton, MenuItem, MessageDialog, OverlayTrigger, Tooltip } from 'patternfly-react';
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
import { style } from 'typestyle';

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
};

const DELETE_TRAFFIC_ROUTING = 'delete_traffic_routing';
const DELETE_THREESCALE_INTEGRATION = 'delete_threescale_integration';

const msgDialogStyle = style({
  $nest: {
    '.modal-content': {
      fontSize: '14px'
    }
  }
});

class IstioWizardDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showWizard: props.show,
      wizardType: '',
      showConfirmDelete: false,
      deleteAction: '',
      isDeleting: false,
      updateWizard: false
    };
  }

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

  renderMenuItem = (eventKey: string, updateLabel: string) => {
    switch (eventKey) {
      case WIZARD_WEIGHTED_ROUTING:
      case WIZARD_MATCHING_ROUTING:
      case WIZARD_SUSPEND_TRAFFIC:
        // An Item is rendered under two conditions:
        // a) No traffic -> Wizard can create new one
        // b) Existing traffic generated by the traffic -> Wizard can update that scenario
        // Otherwise, the item should be disabled
        const enabledItem = !this.hasTrafficRouting() || (this.hasTrafficRouting() && updateLabel === eventKey);
        const menuItem = (
          <MenuItem disabled={!enabledItem} key={eventKey} eventKey={eventKey}>
            {updateLabel === eventKey ? WIZARD_UPDATE_TITLES[eventKey] : WIZARD_TITLES[eventKey]}
          </MenuItem>
        );
        return !enabledItem ? (
          <OverlayTrigger
            placement={'left'}
            overlay={<Tooltip id={'mtls-status-masthead'}>Traffic routing already exists for this service</Tooltip>}
            trigger={['hover', 'focus']}
            rootClose={false}
            key={eventKey}
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
            key={eventKey}
          >
            {deleteMenuItem}
          </OverlayTrigger>
        ) : (
          deleteMenuItem
        );
      case WIZARD_THREESCALE_INTEGRATION:
        const threeScaleEnabledItem =
          !this.props.threeScaleServiceRule || (this.props.threeScaleServiceRule && updateLabel === eventKey);
        const threeScaleMenuItem = (
          <MenuItem disabled={!threeScaleEnabledItem} key={eventKey} eventKey={eventKey}>
            {updateLabel === eventKey ? WIZARD_UPDATE_TITLES[eventKey] : WIZARD_TITLES[eventKey]}
          </MenuItem>
        );
        const toolTipMsgExists = '3scale API Integration Rule already exists for this service';
        return !threeScaleEnabledItem ? (
          <OverlayTrigger
            placement={'left'}
            overlay={<Tooltip id={'mtls-status-masthead'}>{toolTipMsgExists}</Tooltip>}
            trigger={['hover', 'focus']}
            rootClose={false}
            key={eventKey}
          >
            {threeScaleMenuItem}
          </OverlayTrigger>
        ) : (
          threeScaleMenuItem
        );
      case DELETE_THREESCALE_INTEGRATION:
        const deleteThreeScaleMenuItem = (
          <MenuItem
            disabled={!this.props.threeScaleServiceRule || this.state.isDeleting}
            key={eventKey}
            eventKey={eventKey}
          >
            Delete 3Scale API Management Rule
          </MenuItem>
        );
        const toolTipMsgDelete = 'There is not a 3scale API Integration Rule for this service';
        return !this.props.threeScaleServiceRule ? (
          <OverlayTrigger
            placement={'left'}
            overlay={<Tooltip id={'mtls-status-masthead'}>{toolTipMsgDelete}</Tooltip>}
            trigger={['hover', 'focus']}
            rootClose={false}
            key={eventKey}
          >
            {deleteThreeScaleMenuItem}
          </OverlayTrigger>
        ) : (
          deleteThreeScaleMenuItem
        );
      default:
        return <>Unsupported</>;
    }
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
    deleteMessage += ' ?.  ';
    return deleteMessage;
  };

  render() {
    const updateLabel = this.getVSWizardLabel();
    return (
      <>
        <DropdownButton id="service_actions" title="Actions" onSelect={this.onAction} pullRight={true}>
          {(this.canCreate() || this.canUpdate()) &&
            WIZARD_ACTIONS.map(action => this.renderMenuItem(action, updateLabel))}
          <MenuItem divider={true} />
          {this.canDelete() && this.renderMenuItem(DELETE_TRAFFIC_ROUTING, '')}
          {this.props.threeScaleInfo.enabled && <MenuItem divider={true} />}
          {this.props.threeScaleInfo.enabled &&
            this.renderMenuItem(
              WIZARD_THREESCALE_INTEGRATION,
              this.props.threeScaleServiceRule ? WIZARD_THREESCALE_INTEGRATION : ''
            )}
          {this.props.threeScaleInfo.enabled && this.renderMenuItem(DELETE_THREESCALE_INTEGRATION, '')}
        </DropdownButton>
        <IstioWizard
          show={this.state.showWizard}
          type={this.state.wizardType}
          update={this.state.updateWizard}
          namespace={this.props.namespace}
          serviceName={this.props.serviceName}
          workloads={this.props.workloads.filter(workload => {
            const appLabelName = serverConfig.istioLabels.versionLabelName;
            const versionLabelName = serverConfig.istioLabels.versionLabelName;
            return workload.labels && workload.labels[appLabelName] && workload.labels[versionLabelName];
          })}
          virtualServices={this.props.virtualServices}
          destinationRules={this.props.destinationRules}
          gateways={this.props.gateways}
          threeScaleServiceRule={this.props.threeScaleServiceRule}
          tlsStatus={this.props.tlsStatus}
          onClose={this.onClose}
        />
        <MessageDialog
          className={msgDialogStyle}
          show={this.state.showConfirmDelete}
          primaryAction={this.onDelete}
          secondaryAction={this.hideConfirmDelete}
          onHide={this.hideConfirmDelete}
          primaryActionButtonContent="Delete"
          secondaryActionButtonContent="Cancel"
          primaryActionButtonBsStyle="danger"
          title="Confirm Delete"
          primaryContent={this.getDeleteMessage()}
          secondaryContent="It cannot be undone. Make sure this is something you really want to do!"
          accessibleName="deleteConfirmationDialog"
          accessibleDescription="deleteConfirmationDialogContent"
        />
      </>
    );
  }
}

export default IstioWizardDropdown;
