import * as React from 'react';
import { Dropdown, DropdownList, MenuToggle, MenuToggleElement, TooltipPosition } from '@patternfly/react-core';
import { WorkloadOverview } from '../../types/ServiceInfo';
import {
  DestinationRule,
  DestinationRuleC,
  getWizardUpdateLabel,
  K8sGRPCRoute,
  K8sHTTPRoute,
  PeerAuthentication,
  VirtualService
} from '../../types/IstioObjects';
import * as AlertUtils from '../../utils/AlertUtils';
import { serverConfig } from '../../config';
import { TLSStatus } from '../../types/TLSStatus';
import * as API from '../../services/Api';
import {
  buildAnnotationPatch,
  WIZARD_REQUEST_ROUTING,
  WIZARD_FAULT_INJECTION,
  WIZARD_TRAFFIC_SHIFTING,
  WIZARD_REQUEST_TIMEOUTS,
  WIZARD_TCP_TRAFFIC_SHIFTING,
  WIZARD_K8S_REQUEST_ROUTING,
  WIZARD_K8S_GRPC_REQUEST_ROUTING,
  WIZARD_EDIT_ANNOTATIONS
} from './WizardActions';
import { MessageType } from '../../types/MessageCenter';
import { WizardLabels } from './WizardLabels';
import { ServiceWizard } from './ServiceWizard';
import { canCreate, canUpdate, ResourcePermissions } from '../../types/Permissions';
import { ServiceWizardActionsDropdownGroup, DELETE_TRAFFIC_ROUTING } from './ServiceWizardActionsDropdownGroup';
import { ConfirmDeleteTrafficRoutingModal } from './ConfirmDeleteTrafficRoutingModal';
import { deleteServiceTrafficRouting } from 'services/Api';
import { ServiceOverview } from '../../types/ServiceList';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { t } from 'utils/I18nUtils';
import { useNavigate } from 'react-router-dom-v5-compat';

type ReduxProps = {
  istioAPIEnabled: boolean;
};

type Props = ReduxProps & {
  annotations: { [key: string]: string };
  cluster?: string;
  destinationRules: DestinationRule[];
  gateways: string[];
  istioPermissions: ResourcePermissions;
  k8sGRPCRoutes: K8sGRPCRoute[];
  k8sGateways: string[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  namespace: string;
  onChange: () => void;
  peerAuthentications: PeerAuthentication[];
  readOnly: boolean;
  serviceName: string;
  show: boolean;
  subServices: ServiceOverview[];
  tlsStatus?: TLSStatus;
  virtualServices: VirtualService[];
  workloads: WorkloadOverview[];
};

const appLabelName = serverConfig.istioLabels.appLabelName;
const versionLabelName = serverConfig.istioLabels.versionLabelName;

const ServiceWizardDropdownComponent: React.FC<Props> = (props: Props) => {
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const [isActionsOpen, setIsActionsOpen] = React.useState<boolean>(false);
  const [showAnnotationsWizard, setShowAnnotationsWizard] = React.useState<boolean>(false);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState<boolean>(false);
  const [showWizard, setShowWizard] = React.useState<boolean>(props.show);
  const [updateWizard, setUpdateWizard] = React.useState<boolean>(false);
  const [wizardType, setWizardType] = React.useState<string>('');

  const checkHasMeshWorkloads = (): boolean => {
    let hasMeshWorkloads = false;
    for (let i = 0; i < props.workloads.length; i++) {
      if (props.workloads[i].istioSidecar) {
        // At least one workload with sidecar
        hasMeshWorkloads = true;
        break;
      }
      // Check for Ambient if in Ambient Mesh
      if (serverConfig.ambientEnabled && props.workloads[i].isAmbient) {
        hasMeshWorkloads = true;
        break;
      }
    }
    return hasMeshWorkloads;
  };

  const hideConfirmDelete = (): void => {
    setShowConfirmDelete(false);
  };

  const getValidWorkloads = (): WorkloadOverview[] => {
    return props.workloads.filter(workload => {
      // A workload could skip the version label on this check only when there is a single workload list
      return (
        workload.labels &&
        workload.labels[appLabelName] &&
        (workload.labels[versionLabelName] || props.workloads.length === 1)
      );
    });
  };
  const navigate = useNavigate();

  const newServiceWizard = (serviceWizard: string): void => {
    const wizardUrl = `/namespaces/${props.namespace}/services/${props.serviceName}/wizard/${serviceWizard}`;
    const updateLabel = getWizardUpdateLabel(props.virtualServices, props.k8sHTTPRoutes, props.k8sGRPCRoutes);

    switch (serviceWizard) {
      case WIZARD_TRAFFIC_SHIFTING: {
        navigate(wizardUrl);
        break;
      }
      case WIZARD_REQUEST_ROUTING:
      case WIZARD_FAULT_INJECTION:
      case WIZARD_TCP_TRAFFIC_SHIFTING:
      case WIZARD_K8S_REQUEST_ROUTING:
      case WIZARD_K8S_GRPC_REQUEST_ROUTING:
      case WIZARD_REQUEST_TIMEOUTS: {
        setShowWizard(true);
        setWizardType(serviceWizard);
        setUpdateWizard(serviceWizard === updateLabel);
        break;
      }
      case DELETE_TRAFFIC_ROUTING: {
        setShowConfirmDelete(true);
        break;
      }
      case WIZARD_EDIT_ANNOTATIONS: {
        setShowAnnotationsWizard(true);
        break;
      }
      default:
        console.log('Unrecognized key');
    }
  };

  const onActionsSelect = (): void => {
    setIsActionsOpen(!isActionsOpen);
  };

  const onActionsToggle = (isOpen: boolean): void => {
    setIsActionsOpen(isOpen);
  };

  const onClose = (changed: boolean): void => {
    setShowWizard(false);
    if (changed) {
      props.onChange();
    }
  };

  const onDelete = (): void => {
    setIsDeleting(true);
    hideConfirmDelete();

    deleteServiceTrafficRouting(
      props.virtualServices,
      DestinationRuleC.fromDrArray(props.destinationRules),
      props.k8sHTTPRoutes,
      props.k8sGRPCRoutes,
      props.cluster
    )
      .then(_results => {
        AlertUtils.addSuccess(`Istio Config deleted for ${props.serviceName} service.`);

        setIsDeleting(false);
        props.onChange();
      })
      .catch(error => {
        AlertUtils.addError('Could not delete Istio config objects.', error);

        setIsDeleting(false);
      });
  };

  const onChangeAnnotations = (annotations: { [key: string]: string }): void => {
    const jsonInjectionPatch = buildAnnotationPatch(annotations);

    API.updateService(props.namespace, props.serviceName, jsonInjectionPatch, 'json', props.cluster)
      .then(_ => {
        AlertUtils.add(`Service ${props.serviceName} updated`, 'default', MessageType.SUCCESS);
      })
      .catch(error => {
        AlertUtils.addError(`Could not update service ${props.serviceName}`, error);
      })
      .finally(() => {
        setShowAnnotationsWizard(false);
        props.onChange();
      });
  };

  const hasMeshWorkloads = checkHasMeshWorkloads();
  const toolTipMsgActions = !hasMeshWorkloads
    ? t('There are not Workloads with sidecar for this service')
    : `There are not Workloads with ${appLabelName} and ${versionLabelName} labels`;

  const validWorkloads = getValidWorkloads();
  const validActions = hasMeshWorkloads && validWorkloads;

  const dropdown = (
    <Dropdown
      data-test="service-actions-dropdown"
      id="actions"
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          id="actions-toggle"
          onClick={() => onActionsToggle(!isActionsOpen)}
          data-test="service-actions-toggle"
          isExpanded={isActionsOpen}
          isDisabled={!validActions}
        >
          {t('Actions')}
        </MenuToggle>
      )}
      isOpen={isActionsOpen}
      onOpenChange={(isOpen: boolean) => onActionsToggle(isOpen)}
      onSelect={onActionsSelect}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>
        <ServiceWizardActionsDropdownGroup
          key="service_wizard_actions_dropdown_group"
          isDisabled={isDeleting || props.readOnly}
          virtualServices={props.virtualServices}
          destinationRules={props.destinationRules}
          k8sHTTPRoutes={props.k8sHTTPRoutes ?? []}
          k8sGRPCRoutes={props.k8sGRPCRoutes ?? []}
          annotations={props.annotations}
          istioPermissions={props.istioPermissions}
          onAction={(action: string) => newServiceWizard(action)}
          onDelete={newServiceWizard}
        />
      </DropdownList>
    </Dropdown>
  );
  return (
    <>
      {!hasMeshWorkloads
        ? renderDisabledDropdownOption('tooltip_wizard_actions', TooltipPosition.top, toolTipMsgActions, dropdown)
        : dropdown}

      <WizardLabels
        showAnotationsWizard={showAnnotationsWizard}
        type={'annotations'}
        onChange={annotations => onChangeAnnotations(annotations)}
        onClose={() => setShowAnnotationsWizard(false)}
        labels={props.annotations}
        canEdit={serverConfig.kialiFeatureFlags.istioAnnotationAction && !serverConfig.deployment.viewOnlyMode}
      />

      <ServiceWizard
        show={showWizard}
        type={wizardType}
        update={updateWizard}
        namespace={props.namespace}
        cluster={props.cluster}
        serviceName={props.serviceName}
        workloads={validWorkloads}
        subServices={props.subServices}
        createOrUpdate={canCreate(props.istioPermissions) || canUpdate(props.istioPermissions)}
        virtualServices={props.virtualServices}
        destinationRules={props.destinationRules}
        gateways={props.gateways}
        k8sGateways={props.k8sGateways}
        k8sGRPCRoutes={props.k8sGRPCRoutes}
        k8sHTTPRoutes={props.k8sHTTPRoutes}
        peerAuthentications={props.peerAuthentications}
        tlsStatus={props.tlsStatus}
        onClose={onClose}
        istioAPIEnabled={props.istioAPIEnabled}
      />

      <ConfirmDeleteTrafficRoutingModal
        destinationRules={DestinationRuleC.fromDrArray(props.destinationRules)}
        virtualServices={props.virtualServices}
        k8sGRPCRoutes={props.k8sGRPCRoutes}
        k8sHTTPRoutes={props.k8sHTTPRoutes}
        isOpen={showConfirmDelete}
        onCancel={hideConfirmDelete}
        onConfirm={onDelete}
      />
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled
});

export const ServiceWizardDropdown = connect(mapStateToProps)(ServiceWizardDropdownComponent);
