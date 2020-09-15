import * as React from 'react';

import ParameterizedTabs, { activeTab } from '../../../../components/Tab/Tabs';
import { Link, RouteComponentProps } from 'react-router-dom';
import { RenderHeader } from '../../../../components/Nav/Page';
import { Breadcrumb, BreadcrumbItem, Tab } from '@patternfly/react-core';
import { style } from 'typestyle';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import {
  emptyExperimentDetailsInfo,
  ExperimentAction,
  Iter8ExpDetailsInfo,
  Iter8Info,
  MetricProgressInfo
} from '../../../../types/Iter8';
import Iter8Dropdown, { ManualOverride } from './Iter8Dropdown';
import history from '../../../../app/History';
import * as FilterHelper from '../../../../components/FilterList/FilterHelper';
import { connect } from 'react-redux';

import ExperimentInfoDescription from './ExperimentInfoDescription';
import CriteriaInfoDescription from './CriteriaInfoDescription';
import AssessmentInfoDescription from './AssessmentInfoDescription';
import { KialiAppState } from '../../../../store/Store';
import { durationSelector } from '../../../../store/Selectors';
import { PfColors } from '../../../../components/Pf/PfColors';
import { DurationInSeconds, TimeInMilliseconds } from '../../../../types/Common';
import RefreshContainer from '../../../../components/Refresh/Refresh';

interface ExpeerimentId {
  namespace: string;
  name: string;
}

interface Props extends RouteComponentProps<ExpeerimentId> {
  duration: DurationInSeconds;
}

interface State {
  iter8Info: Iter8Info;
  experiment: Iter8ExpDetailsInfo;
  currentTab: string;
  canDelete: boolean;
  target: string;
  baseline: string;
  actionTaken: string;
  resetActionFlag: boolean;
  manualOverride: ManualOverride;
  lastRefreshAt: TimeInMilliseconds;
}

const tabName = 'tab';
const defaultTab = 'overview';

const tabIndex: { [tab: string]: number } = {
  info: 0,
  assessment: 1,
  criteria: 2
};
const extensionHeader = style({
  padding: '0px 20px 16px 0px',
  backgroundColor: PfColors.White
});
const breadcrumbPadding = style({
  padding: '22px 0 5px 0'
});

class ExperimentDetailsPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const urlParams = new URLSearchParams(history.location.search);

    let baseline = urlParams.get('baseline') || '';
    let candidates = urlParams.get('candidates')?.split(',') || [];
    let trafficSplit = new Map<string, number>();
    trafficSplit.set(baseline, 0);
    candidates.forEach(c => {
      trafficSplit.set(c, 0);
    });
    this.state = {
      iter8Info: {
        enabled: false,
        supportedVersion: false,
        analyticsImageVersion: '',
        controllerImageVersion: ''
      },
      experiment: emptyExperimentDetailsInfo,
      canDelete: false,
      currentTab: activeTab(tabName, defaultTab),
      target: urlParams.get('target') || '',
      baseline: baseline,
      actionTaken: '',
      resetActionFlag: false,
      manualOverride: {
        TrafficSplit: trafficSplit,
        totalTrafficSplitPercentage: 0
      },
      lastRefreshAt: Date.now()
    };
  }

  initTrafficSplit = (experiment): ManualOverride => {
    if (this.state.manualOverride.TrafficSplit.size !== 0) {
      return this.state.manualOverride;
    } else {
      let trafficSplit = new Map<string, number>();
      trafficSplit.set(experiment.experimentItem.baseline.name, 0);
      experiment.experimentItem.candidates.forEach(c => {
        trafficSplit.set(c.name, 0);
      });
      return {
        TrafficSplit: trafficSplit,
        totalTrafficSplitPercentage: 0
      };
    }
  };

  fetchExperiment = () => {
    const namespace = this.props.match.params.namespace;
    const name = this.props.match.params.name;
    API.getIter8Info()
      .then(result => {
        const iter8Info = result.data;
        if (iter8Info.enabled) {
          API.getExperiment(namespace, name)
            .then(result => {
              let manualOverride = this.initTrafficSplit(result.data);
              if (this.state.resetActionFlag) {
                this.setState({
                  iter8Info: iter8Info,
                  actionTaken: '',
                  experiment: result.data,
                  canDelete: result.data.permissions.delete,
                  resetActionFlag: false,
                  manualOverride: manualOverride,
                  lastRefreshAt: Date.now()
                });
              } else {
                this.setState({
                  experiment: result.data,
                  canDelete: result.data.permissions.delete,
                  resetActionFlag: true,
                  manualOverride: manualOverride,
                  lastRefreshAt: Date.now()
                });
              }
            })
            .catch(error => {
              AlertUtils.addError('Could not fetch Iter8 Experiment', error);
            });
        } else {
          AlertUtils.addError('Kiali has Iter8 extension enabled but it is not detected in the cluster');
        }
      })

      .catch(error => {
        AlertUtils.addError('Could not fetch Iter8 Info.', error);
      });
  };

  componentDidMount() {
    this.fetchExperiment();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.currentTab !== activeTab(tabName, defaultTab) || prevProps.duration !== this.props.duration) {
      this.setState({
        currentTab: activeTab(tabName, defaultTab)
      });
    }
  }

  // Extensions breadcrumb,
  breadcrumb = () => {
    return (
      <div className={extensionHeader}>
        <Breadcrumb className={breadcrumbPadding}>
          <BreadcrumbItem>
            <Link to={`/extensions/iter8`}>Iter8 Experiments</Link>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <Link to={`/extensions/iter8?namespaces=${this.props.match.params.namespace}`}>
              Namespace: {this.props.match.params.namespace}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive={true}>
            <Link
              to={
                '/extensions/namespaces/' + this.props.match.params.namespace + '/iter8/' + this.props.match.params.name
              }
            >
              {this.props.match.params.name}
            </Link>
          </BreadcrumbItem>
        </Breadcrumb>
      </div>
    );
  };

  backToList = () => {
    // Back to list page
    history.push(`/extensions/iter8?namespaces=${this.props.match.params.namespace}`);
  };

  doRefresh = () => {
    this.fetchExperiment();
  };

  doDelete = () => {
    API.deleteExperiment(this.props.match.params.namespace, this.props.match.params.name)
      .then(() => this.backToList())
      .catch(error => {
        AlertUtils.addError('Could not delete Iter8 Experiment.', error);
      });
  };

  doTrafficSplit = (manualOverride: ManualOverride) => {
    this.setState(prevState => {
      prevState.manualOverride.TrafficSplit = manualOverride.TrafficSplit;
      prevState.manualOverride.totalTrafficSplitPercentage = manualOverride.totalTrafficSplitPercentage;
      return {
        manualOverride: prevState.manualOverride
      };
    });
  };

  doIter8Action = (requestAction: string): void => {
    let errMsg = 'Could not' + requestAction + ' Iter8 Experiment';
    const action: ExperimentAction = {
      action: requestAction,
      trafficSplit: []
    };
    if (requestAction === 'terminate') {
      action.trafficSplit = Array.from(this.state.manualOverride.TrafficSplit.entries());
    }
    this.setState({ actionTaken: requestAction });
    API.updateExperiment(this.props.match.params.namespace, this.props.match.params.name, JSON.stringify(action))
      .then(() => this.doRefresh())
      .catch(error => {
        this.setState({ actionTaken: '' });
        AlertUtils.addError(errMsg, error);
      });
  };

  renderRightToolbar = () => {
    return (
      <span style={{ position: 'absolute', right: '20px', zIndex: 1 }}>
        <RefreshContainer id="time_range_refresh" hideLabel={true} handleRefresh={this.doRefresh} manageURL={true} />
        <Iter8Dropdown
          experimentName={this.props.match.params.name}
          manualOverride={this.state.manualOverride}
          canDelete={this.state.canDelete}
          startTime={this.state.experiment ? this.state.experiment.experimentItem.startTime : ''}
          endTime={this.state.experiment ? this.state.experiment.experimentItem.endTime : ''}
          phase={this.state.experiment ? this.state.experiment.experimentItem.phase : ' '}
          onDelete={this.doDelete}
          onResume={() => this.doIter8Action('resume')}
          onPause={() => this.doIter8Action('pause')}
          onTerminate={() => this.doIter8Action('terminate')}
          doTrafficSplit={this.doTrafficSplit}
        />
      </span>
    );
  };

  render() {
    const overviewTab = (
      <Tab eventKey={0} title="Overview" key="Overview">
        <ExperimentInfoDescription
          namespace={this.props.match.params.namespace}
          experiment={this.props.match.params.name}
          target={this.state.target}
          experimentDetails={this.state.experiment}
          duration={FilterHelper.currentDuration()}
          actionTaken={this.state.actionTaken}
        />
      </Tab>
    );
    const metricProgressInfo: Map<string, MetricProgressInfo> = new Map<string, MetricProgressInfo>(); //= new Array(this.state.experiment.criterias.length);
    for (const c of this.state.experiment.criterias) {
      metricProgressInfo.set(c.name, {
        name: c.name,
        threshold: c.criteria.tolerance,
        thresholdType: c.criteria.toleranceType,
        preferred_direction: c.metric.preferred_direction,
        isReward: c.criteria.isReward,
        unit: c.metric.numerator.unit
      });
    }

    const assessmentTab = (
      <Tab eventKey={1} title="Assessment" key="Assessment">
        <AssessmentInfoDescription
          lastRefreshAt={this.state.lastRefreshAt}
          iter8Info={this.state.iter8Info}
          name={this.props.match.params.name}
          namespace={this.props.match.params.namespace}
          experimentItem={this.state.experiment.experimentItem}
          metricInfo={metricProgressInfo}
          duration={this.props.duration}
          fetchOp={() => this.fetchExperiment()}
        />
      </Tab>
    );

    const criteriaTab = (
      <Tab eventKey={2} title="Criteria" key="Criteria">
        <CriteriaInfoDescription
          iter8Info={this.state.iter8Info}
          criterias={this.state.experiment ? this.state.experiment.criterias : []}
        />
      </Tab>
    );
    const tabsArray: any[] = [overviewTab, assessmentTab, criteriaTab];
    return (
      <>
        <RenderHeader>
          {this.breadcrumb()}
          {this.renderRightToolbar()}
        </RenderHeader>

        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={tabIndex}
          tabName={tabName}
          defaultTab={defaultTab}
          postHandler={this.fetchExperiment}
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
  duration: durationSelector(state)
});

const ExperimentDetailsPageContainer = connect(mapStateToProps, null)(ExperimentDetailsPage);

export default ExperimentDetailsPageContainer;
