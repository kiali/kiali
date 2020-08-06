import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { ExclamationCircleIcon, ExternalLinkAltIcon } from '@patternfly/react-icons';
import { Tab } from '@patternfly/react-core';

import * as API from '../../services/Api';
import { App, AppId } from '../../types/App';
import AppInfo from './AppInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { JaegerInfo } from '../../types/JaegerInfo';
import { PfColors } from '../../components/Pf/PfColors';
import AppTraces from '../../components/JaegerIntegration/AppTraces';

type AppDetailsState = {
  app?: App;
  // currentTab is needed to (un)mount tab components
  // when the tab is not rendered.
  currentTab: string;
  nbErrorTraces: number;
};

type ReduxProps = {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
};

type AppDetailsProps = RouteComponentProps<AppId> & ReduxProps;

const tabName = 'tab';
const defaultTab = 'info';
const tracesTabName = 'traces';
const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  in_metrics: 2,
  out_metrics: 3,
  traces: 4
};
const nextTabIndex = 5;

class AppDetails extends React.Component<AppDetailsProps, AppDetailsState> {
  constructor(props: AppDetailsProps) {
    super(props);
    this.state = { currentTab: activeTab(tabName, defaultTab), nbErrorTraces: 0 };
  }

  componentDidMount(): void {
    this.fetchApp();
    this.fetchJaegerErrors();
  }

  componentDidUpdate(prevProps: AppDetailsProps) {
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.app !== prevProps.match.params.app ||
      this.state.currentTab !== activeTab(tabName, defaultTab) ||
      this.props.duration !== prevProps.duration
    ) {
      this.setState({ currentTab: activeTab(tabName, defaultTab) }, () => this.fetchJaegerErrors());
      this.fetchApp();
    }
  }

  private fetchJaegerErrors = () => {
    if (this.props.jaegerInfo && this.props.jaegerInfo.integration) {
      API.getJaegerErrorTraces(this.props.match.params.namespace, this.props.match.params.app, this.props.duration)
        .then(inError => {
          this.setState({ nbErrorTraces: inError.data });
        })
        .catch(error => {
          AlertUtils.addError('Could not fetch Jaeger errors.', error);
        });
    }
  };

  private fetchApp = () => {
    API.getApp(this.props.match.params.namespace, this.props.match.params.app)
      .then(details => this.setState({ app: details.data }))
      .catch(error => AlertUtils.addError('Could not fetch App Details.', error));
  };

  private runtimeTabs() {
    let dynamicTabsCount: number = 0;

    const tabs: JSX.Element[] = [];
    if (this.state.app) {
      this.state.app.runtimes.forEach(runtime => {
        runtime.dashboardRefs.forEach(dashboard => {
          const tabKey = dynamicTabsCount + nextTabIndex;
          paramToTab['cd-' + dashboard.template] = tabKey;

          const tab = (
            <Tab title={dashboard.title} key={'cd-' + dashboard.template} eventKey={tabKey}>
              <CustomMetricsContainer
                namespace={this.props.match.params.namespace}
                app={this.props.match.params.app}
                template={dashboard.template}
              />
            </Tab>
          );
          tabs.push(tab);
          dynamicTabsCount = dynamicTabsCount + 1;
        });
      });
    }

    return tabs;
  }

  private staticTabs() {
    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <AppInfo app={this.state.app} duration={this.props.duration} onRefresh={this.fetchApp} />
      </Tab>
    );

    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          itemType={MetricsObjectTypes.APP}
          namespace={this.props.match.params.namespace}
          appName={this.props.match.params.app}
          duration={this.props.duration}
        />
      </Tab>
    );

    const inTab = (
      <Tab title="Inbound Metrics" eventKey={2} key={'Inbound Metrics'}>
        <IstioMetricsContainer
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.app}
          objectType={MetricsObjectTypes.APP}
          direction={'inbound'}
        />
      </Tab>
    );

    const outTab = (
      <Tab title="Outbound Metrics" eventKey={3} key={'Outbound Metrics'}>
        <IstioMetricsContainer
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.app}
          objectType={MetricsObjectTypes.APP}
          direction={'outbound'}
        />
      </Tab>
    );

    // Default tabs
    const tabsArray: any[] = [overTab, trafficTab, inTab, outTab];

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
          <Tab eventKey={4} style={{ textAlign: 'center' }} title={jaegerTitle} key={tracesTabName}>
            <AppTraces
              namespace={this.props.match.params.namespace}
              app={this.props.match.params.app}
              showErrors={this.state.nbErrorTraces > 0}
              duration={this.props.duration}
            />
          </Tab>
        );
      } else {
        const service = this.props.jaegerInfo.namespaceSelector
          ? this.props.match.params.app + '.' + this.props.match.params.namespace
          : this.props.match.params.app;
        jaegerTag = (
          <Tab
            eventKey={4}
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

    return tabsArray;
  }

  private renderTabs() {
    // PF4 Tabs doesn't support static tabs followed of an array of tabs created dynamically.
    return this.staticTabs().concat(this.runtimeTabs());
  }

  render() {
    return (
      <>
        <RenderHeader location={this.props.location}>
          {
            // This magic space will align details header width with Graph, List pages
          }
          <div style={{ paddingBottom: 14 }} />
        </RenderHeader>
        {this.state.app && (
          <ParameterizedTabs
            id="basic-tabs"
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue });
            }}
            tabMap={paramToTab}
            tabName={tabName}
            defaultTab={defaultTab}
            activeTab={this.state.currentTab}
            mountOnEnter={true}
            unmountOnExit={true}
          >
            {this.renderTabs()}
          </ParameterizedTabs>
        )}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  jaegerInfo: state.jaegerState.info
});

const AppDetailsContainer = connect(mapStateToProps)(AppDetails);

export default AppDetailsContainer;
