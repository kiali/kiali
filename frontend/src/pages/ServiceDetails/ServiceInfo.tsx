import * as React from 'react';
import { style } from 'typestyle';
import { Grid, GridItem, Stack, StackItem } from '@patternfly/react-core';
import ServiceId from '../../types/ServiceId';
import ServiceDescription from './ServiceDescription';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { Gateway, ObjectValidation, PeerAuthentication, Validations } from '../../types/IstioObjects';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { DurationInSeconds, TimeInMilliseconds } from 'types/Common';
import GraphDataSource from 'services/GraphDataSource';
import {
  drToIstioItems,
  vsToIstioItems,
  gwToIstioItems,
  seToIstioItems,
  validationKey
} from '../../types/IstioConfigList';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector, meshWideMTLSEnabledSelector } from '../../store/Selectors';
import MiniGraphCard from '../../components/CytoscapeGraph/MiniGraphCard';
import IstioConfigCard from '../../components/IstioConfigCard/IstioConfigCard';
import ServiceNetwork from './ServiceNetwork';
import { GraphEdgeTapEvent } from '../../components/CytoscapeGraph/CytoscapeGraph';
import history, { URLParam } from '../../app/History';

interface Props extends ServiceId {
  duration: DurationInSeconds;
  lastRefreshAt: TimeInMilliseconds;
  mtlsEnabled: boolean;
  serviceDetails?: ServiceDetailsInfo;
  gateways: Gateway[];
  peerAuthentications: PeerAuthentication[];
  validations: Validations;
}

type ServiceInfoState = {
  tabHeight?: number;
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
      tabHeight: 300
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
    this.graphDataSource.fetchForService(this.props.duration, this.props.namespace, this.props.service);
  };

  private getServiceValidation(): ObjectValidation | undefined {
    if (this.props.validations && this.props.validations.service && this.props.serviceDetails) {
      return this.props.validations.service[
        validationKey(this.props.serviceDetails.service.name, this.props.namespace)
      ];
    }
    return undefined;
  }

  render() {
    const vsIstioConfigItems = this.props.serviceDetails?.virtualServices
      ? vsToIstioItems(this.props.serviceDetails.virtualServices, this.props.serviceDetails.validations)
      : [];
    const drIstioConfigItems = this.props.serviceDetails?.destinationRules
      ? drToIstioItems(this.props.serviceDetails.destinationRules, this.props.serviceDetails.validations)
      : [];
    const gwIstioConfigItems =
      this.props?.gateways && this.props.serviceDetails?.virtualServices
        ? gwToIstioItems(
            this.props?.gateways,
            this.props.serviceDetails.virtualServices,
            this.props.serviceDetails.validations
          )
        : [];
    const seIstioConfigItems = this.props.serviceDetails?.serviceEntries
      ? seToIstioItems(this.props.serviceDetails.serviceEntries, this.props.serviceDetails.validations)
      : [];
    const istioConfigItems = seIstioConfigItems.concat(
      gwIstioConfigItems.concat(vsIstioConfigItems.concat(drIstioConfigItems))
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
              <MiniGraphCard
                dataSource={this.graphDataSource}
                mtlsEnabled={this.props.mtlsEnabled}
                onEdgeTap={this.goToMetrics}
                graphContainerStyle={graphContainerStyle}
              />
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  lastRefreshAt: state.globalState.lastRefreshAt,
  mtlsEnabled: meshWideMTLSEnabledSelector(state)
});

const ServiceInfoContainer = connect(mapStateToProps)(ServiceInfo);
export default ServiceInfoContainer;
