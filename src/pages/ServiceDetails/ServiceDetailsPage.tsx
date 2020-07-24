import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { Tab } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

import ServiceId from '../../types/ServiceId';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import { MetricsObjectTypes } from '../../types/Metrics';
import { KialiAppState } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import { durationSelector } from '../../store/Selectors';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { JaegerInfo } from '../../types/JaegerInfo';
import { PfColors } from '../../components/Pf/PfColors';
import ServiceTraces from 'components/JaegerIntegration/ServiceTraces';
import ServiceInfo from './ServiceInfo';
import TrafficDetails from '../../components/Metrics/TrafficDetails';

type ServiceDetailsState = {
  nbErrorTraces: number;
  currentTab: string;
};

interface ServiceDetailsProps extends RouteComponentProps<ServiceId> {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
}

const tabName = 'tab';
const defaultTab = 'info';
const trafficTabName = 'traffic';
const tracesTabName = 'traces';

const tabIndex: { [tab: string]: number } = {
  info: 0,
  traffic: 1,
  metrics: 2,
  traces: 3
};

class ServiceDetails extends React.Component<ServiceDetailsProps, ServiceDetailsState> {
  constructor(props: ServiceDetailsProps) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab),
      nbErrorTraces: 0
    };
  }

  componentDidMount() {
    this.fetchJaegerErrors();
  }

  componentDidUpdate(prevProps: ServiceDetailsProps, _prevState: ServiceDetailsState) {
    if (
      prevProps.match.params.namespace !== this.props.match.params.namespace ||
      prevProps.match.params.service !== this.props.match.params.service ||
      this.state.currentTab !== activeTab(tabName, defaultTab) ||
      prevProps.duration !== this.props.duration
    ) {
      this.setState({ currentTab: activeTab(tabName, defaultTab) }, () => this.fetchJaegerErrors());
    }
  }

  private fetchJaegerErrors = () => {
    if (this.props.jaegerInfo && this.props.jaegerInfo.integration) {
      API.getJaegerErrorTraces(this.props.match.params.namespace, this.props.match.params.service, this.props.duration)
        .then(inError => {
          this.setState({ nbErrorTraces: inError.data });
        })
        .catch(error => {
          AlertUtils.addError('Could not fetch Jaeger errors.', error);
        });
    }
  };

  render() {
    const overviewTab = (
      <Tab eventKey={0} title="Overview" key="Overview">
        <ServiceInfo
          namespace={this.props.match.params.namespace}
          service={this.props.match.params.service}
          duration={this.props.duration}
        />
      </Tab>
    );
    const trafficTab = (
      <Tab eventKey={1} title="Traffic" key={trafficTabName}>
        <TrafficDetails
          itemType={MetricsObjectTypes.SERVICE}
          namespace={this.props.match.params.namespace}
          serviceName={this.props.match.params.service}
          duration={this.props.duration}
        />
      </Tab>
    );
    const inboundMetricsTab = (
      <Tab eventKey={2} title="Inbound Metrics" key="Inbound Metrics">
        <IstioMetricsContainer
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.service}
          objectType={MetricsObjectTypes.SERVICE}
          direction={'inbound'}
        />
      </Tab>
    );

    // Default tabs
    const tabsArray: any[] = [overviewTab, trafficTab, inboundMetricsTab];

    // Conditional Traces tab
    if (this.props.jaegerInfo && this.props.jaegerInfo.enabled) {
      let jaegerTag: any = undefined;
      if (this.props.jaegerInfo.integration) {
        const jaegerTitle =
          this.state.nbErrorTraces > 0 ? (
            <>
              Traces <ExclamationCircleIcon color={PfColors.Red200} />{' '}
            </>
          ) : (
            'Traces'
          );
        jaegerTag = (
          <Tab eventKey={3} style={{ textAlign: 'center' }} title={jaegerTitle} key={tracesTabName}>
            <ServiceTraces
              namespace={this.props.match.params.namespace}
              service={this.props.match.params.service}
              showErrors={this.state.nbErrorTraces > 0}
              duration={this.props.duration}
            />
          </Tab>
        );
      } else {
        const service = this.props.jaegerInfo.namespaceSelector
          ? this.props.match.params.service + '.' + this.props.match.params.namespace
          : this.props.match.params.service;
        jaegerTag = (
          <Tab
            eventKey={3}
            href={this.props.jaegerInfo.url + `/search?service=${service}`}
            target="_blank"
            title={
              <>
                Traces <ExternalLinkAltIcon />
              </>
            }
          />
        );
      }
      tabsArray.push(jaegerTag);
    }

    return (
      <>
        <RenderHeader location={this.props.location}>
          {
            // This magic space will align details header width with Graph, List pages
          }
          <div style={{ paddingBottom: 14 }} />
        </RenderHeader>
        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={tabIndex}
          tabName={tabName}
          defaultTab={defaultTab}
          activeTab={this.state.currentTab}
          mountOnEnter={true}
          unmountOnExit={true}
        >
          {tabsArray}
        </ParameterizedTabs>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  jaegerInfo: state.jaegerState.info
});

const ServiceDetailsPageContainer = connect(mapStateToProps)(ServiceDetails);
export default ServiceDetailsPageContainer;
