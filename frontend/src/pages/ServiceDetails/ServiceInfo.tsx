import * as React from 'react';
import { connect } from 'react-redux';
import { style } from 'typestyle';
import { Grid, GridItem, Stack, StackItem } from '@patternfly/react-core';
import ServiceId from '../../types/ServiceId';
import ServiceDescription from './ServiceDescription';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import {
  DestinationRuleC,
  Gateway,
  getGatewaysAsList,
  getK8sGatewaysAsList,
  K8sGateway,
  ObjectValidation,
  PeerAuthentication,
  Validations
} from '../../types/IstioObjects';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { DurationInSeconds } from 'types/Common';
import GraphDataSource from 'services/GraphDataSource';
import {
  drToIstioItems,
  vsToIstioItems,
  gwToIstioItems,
  seToIstioItems,
  k8sHTTPRouteToIstioItems,
  validationKey,
  k8sGwToIstioItems
} from '../../types/IstioConfigList';
import { canCreate, canUpdate } from '../../types/Permissions';
import { KialiAppState } from '../../store/Store';
import { durationSelector, meshWideMTLSEnabledSelector } from '../../store/Selectors';
import ServiceNetwork from './ServiceNetwork';
import { GraphEdgeTapEvent } from '../../components/CytoscapeGraph/CytoscapeGraph';
import history, { URLParam } from '../../app/History';
import MiniGraphCardContainer from '../../components/CytoscapeGraph/MiniGraphCard';
import IstioConfigCard from '../../components/IstioConfigCard/IstioConfigCard';
import ServiceWizard from '../../components/IstioWizards/ServiceWizard';
import ConfirmDeleteTrafficRoutingModal from '../../components/IstioWizards/ConfirmDeleteTrafficRoutingModal';
import { WizardAction, WizardMode } from '../../components/IstioWizards/WizardActions';
import { deleteServiceTrafficRouting } from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { triggerRefresh } from '../../hooks/refresh';

interface Props extends ServiceId {
  cluster: string;
  duration: DurationInSeconds;
  mtlsEnabled: boolean;
  serviceDetails?: ServiceDetailsInfo;
  gateways: Gateway[];
  k8sGateways: K8sGateway[];
  peerAuthentications: PeerAuthentication[];
  validations: Validations;
  istioAPIEnabled: boolean;
}

type ServiceInfoState = {
  tabHeight?: number;

  // Wizards related
  showWizard: boolean;
  wizardType: string;
  updateMode: boolean;
  showConfirmDeleteTrafficRouting: boolean;
};

const fullHeightStyle = style({
  height: '100%'
});

class ServiceInfo extends React.Component<Props, ServiceInfoState> {
  private promises = new PromisesRegistry();
  private graphDataSource = new GraphDataSource();

  constructor(props: Props) {
    super(props);
    this.state = {
      tabHeight: 300,
      showWizard: false,
      wizardType: '',
      updateMode: false,
      showConfirmDeleteTrafficRouting: false
    };
  }

  componentDidMount() {
    this.fetchBackend();
  }

  componentDidUpdate(prev: Props) {
    if (prev.duration !== this.props.duration || prev.serviceDetails !== this.props.serviceDetails) {
      this.fetchBackend();
    }
  }

  goToMetrics = (e: GraphEdgeTapEvent) => {
    if (e.source !== e.target) {
      const direction = e.source === this.props.service ? 'outbound' : 'inbound';
      const destination = direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service';
      const urlParams = new URLSearchParams(history.location.search);
      urlParams.set('tab', 'metrics');
      urlParams.set(URLParam.BY_LABELS, destination + '=' + (e.source === this.props.service ? e.target : e.source));
      history.replace(history.location.pathname + '?' + urlParams.toString());
    }
  };

  private fetchBackend = () => {
    if (!this.props.serviceDetails) {
      return;
    }

    this.promises.cancelAll();
    this.graphDataSource.fetchForService(
      this.props.duration,
      this.props.namespace,
      this.props.service,
      this.props.cluster
    );
  };

  private getServiceValidation(): ObjectValidation | undefined {
    if (this.props.validations && this.props.validations.service && this.props.serviceDetails) {
      return this.props.validations.service[
        validationKey(this.props.serviceDetails.service.name, this.props.namespace)
      ];
    }
    return undefined;
  }

  private handleWizardClose = (changed: boolean) => {
    this.setState({
      showWizard: false
    });

    if (changed) {
      triggerRefresh();
    }
  };

  private handleConfirmDeleteServiceTrafficRouting = () => {
    this.setState({
      showConfirmDeleteTrafficRouting: false
    });

    deleteServiceTrafficRouting(this.props.serviceDetails!)
      .then(_results => {
        triggerRefresh();
      })
      .catch(error => {
        AlertUtils.addError('Could not delete Istio config objects.', error);
      });
  };

  private handleDeleteTrafficRouting = (_key: string) => {
    this.setState({ showConfirmDeleteTrafficRouting: true });
  };

  private handleLaunchWizard = (action: WizardAction, mode: WizardMode) => {
    this.setState({
      showWizard: true,
      wizardType: action,
      updateMode: mode === 'update'
    });
  };

  render() {
    const vsIstioConfigItems = this.props.serviceDetails?.virtualServices
      ? vsToIstioItems(
          this.props.cluster,
          this.props.serviceDetails.virtualServices,
          this.props.serviceDetails.validations
        )
      : [];
    const drIstioConfigItems = this.props.serviceDetails?.destinationRules
      ? drToIstioItems(
          this.props.cluster,
          this.props.serviceDetails.destinationRules,
          this.props.serviceDetails.validations
        )
      : [];
    const gwIstioConfigItems =
      this.props?.gateways && this.props.serviceDetails?.virtualServices
        ? gwToIstioItems(
            this.props.cluster,
            this.props?.gateways,
            this.props.serviceDetails.virtualServices,
            this.props.serviceDetails.validations
          )
        : [];
    const k8sGwIstioConfigItems =
      this.props?.k8sGateways && this.props.serviceDetails?.k8sHTTPRoutes
        ? k8sGwToIstioItems(
            this.props.cluster,
            this.props?.k8sGateways,
            this.props.serviceDetails.k8sHTTPRoutes,
            this.props.serviceDetails.validations
          )
        : [];
    const seIstioConfigItems = this.props.serviceDetails?.serviceEntries
      ? seToIstioItems(
          this.props.cluster,
          this.props.serviceDetails.serviceEntries,
          this.props.serviceDetails.validations
        )
      : [];
    const k8sHTTPRouteIstioConfigItems = this.props.serviceDetails?.k8sHTTPRoutes
      ? k8sHTTPRouteToIstioItems(
          this.props.cluster,
          this.props.serviceDetails.k8sHTTPRoutes,
          this.props.serviceDetails.validations
        )
      : [];
    const istioConfigItems = seIstioConfigItems.concat(
      gwIstioConfigItems.concat(
        k8sGwIstioConfigItems.concat(vsIstioConfigItems.concat(drIstioConfigItems.concat(k8sHTTPRouteIstioConfigItems)))
      )
    );

    // RenderComponentScroll handles height to provide an inner scroll combined with tabs
    // This height needs to be propagated to minigraph to proper resize in height
    // Graph resizes correctly on width
    const height = this.state.tabHeight ? this.state.tabHeight - 115 : 300;
    const graphContainerStyle = style({ width: '100%', height: height });

    return (
      <>
        <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
          <Grid hasGutter={true} className={fullHeightStyle}>
            <GridItem span={4}>
              <Stack hasGutter={true}>
                <StackItem>
                  <ServiceDescription namespace={this.props.namespace} serviceDetails={this.props.serviceDetails} />
                </StackItem>
                {this.props.serviceDetails && (
                  <ServiceNetwork
                    serviceDetails={this.props.serviceDetails}
                    gateways={this.props.gateways}
                    validations={this.getServiceValidation()}
                  />
                )}
                <StackItem style={{ paddingBottom: '20px' }}>
                  <IstioConfigCard name={this.props.service} items={istioConfigItems} />
                </StackItem>
              </Stack>
            </GridItem>
            <GridItem span={8}>
              <MiniGraphCardContainer
                dataSource={this.graphDataSource}
                mtlsEnabled={this.props.mtlsEnabled}
                onEdgeTap={this.goToMetrics}
                graphContainerStyle={graphContainerStyle}
                serviceDetails={this.props.serviceDetails}
                onDeleteTrafficRouting={this.handleDeleteTrafficRouting}
                onLaunchWizard={this.handleLaunchWizard}
              />
            </GridItem>
          </Grid>
        </RenderComponentScroll>
        <ServiceWizard
          show={this.state.showWizard}
          type={this.state.wizardType}
          update={this.state.updateMode}
          namespace={this.props.namespace}
          serviceName={this.props.serviceDetails?.service?.name || ''}
          workloads={this.props.serviceDetails?.workloads || []}
          subServices={this.props.serviceDetails?.subServices || []}
          createOrUpdate={
            canCreate(this.props.serviceDetails?.istioPermissions) ||
            canUpdate(this.props.serviceDetails?.istioPermissions)
          }
          virtualServices={this.props.serviceDetails?.virtualServices || []}
          destinationRules={this.props.serviceDetails?.destinationRules || []}
          gateways={getGatewaysAsList(this.props.gateways)}
          k8sGateways={getK8sGatewaysAsList(this.props.k8sGateways)}
          k8sHTTPRoutes={this.props.serviceDetails?.k8sHTTPRoutes || []}
          peerAuthentications={this.props.peerAuthentications}
          tlsStatus={this.props.serviceDetails?.namespaceMTLS}
          onClose={this.handleWizardClose}
          istioAPIEnabled={this.props.istioAPIEnabled}
        />
        {this.state.showConfirmDeleteTrafficRouting && (
          <ConfirmDeleteTrafficRoutingModal
            destinationRules={DestinationRuleC.fromDrArray(this.props.serviceDetails!.destinationRules)}
            virtualServices={this.props.serviceDetails!.virtualServices}
            k8sHTTPRoutes={this.props.serviceDetails!.k8sHTTPRoutes}
            isOpen={true}
            onCancel={() => this.setState({ showConfirmDeleteTrafficRouting: false })}
            onConfirm={this.handleConfirmDeleteServiceTrafficRouting}
          />
        )}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  mtlsEnabled: meshWideMTLSEnabledSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled
});

const ServiceInfoContainer = connect(mapStateToProps)(ServiceInfo);
export default ServiceInfoContainer;
