import * as React from 'react';

import ParameterizedTabs, { activeTab } from '../../../../components/Tab/Tabs';
import { RouteComponentProps } from 'react-router-dom';
import { RenderHeader } from '../../../../components/Nav/Page';
import { Tab } from '@patternfly/react-core';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import {
  emptyExperimentDetailsInfo,
  ExperimentAction,
  Iter8ExpDetailsInfo,
  Iter8Info,
  MetricProgressInfo
} from '../../../../types/Iter8';
import Iter8Dropdown from './Iter8Dropdown';
import history from '../../../../app/History';
import { connect } from 'react-redux';

import ExperimentInfoDescription from './ExperimentInfoDescription';
import CriteriaInfoDescription from './CriteriaInfoDescription';
import AssessmentInfoDescription from './AssessmentInfoDescription';
import { KialiAppState } from '../../../../store/Store';
import { durationSelector } from '../../../../store/Selectors';
import { TimeInMilliseconds } from '../../../../types/Common';
import RefreshContainer from '../../../../components/Refresh/Refresh';
import { WorkloadWeight } from '../../../../components/IstioWizards/TrafficShifting';

interface ExpeerimentId {
  namespace: string;
  name: string;
}

interface Props extends RouteComponentProps<ExpeerimentId> {
  lastRefreshAt: TimeInMilliseconds;
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
  manualOverride: WorkloadWeight[];
  lastRefreshAt: TimeInMilliseconds;
}

const tabName = 'tab';
const defaultTab = 'overview';

const tabIndex: { [tab: string]: number } = {
  info: 0,
  assessment: 1,
  criteria: 2
};

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
      manualOverride: [],
      lastRefreshAt: Date.now()
    };
  }

  initTrafficSplit = (experiment): WorkloadWeight[] => {
    if (this.state.manualOverride.length !== 0) {
      return this.state.manualOverride;
    } else {
      let trafficSplit: WorkloadWeight[] = [];
      trafficSplit.push({
        name: experiment.experimentItem.baseline.name,
        weight: 0,
        maxWeight: 100,
        locked: false,
        mirrored: false
      });
      experiment.experimentItem.candidates.forEach(c => {
        trafficSplit.push({
          name: c.name,
          weight: 0,
          maxWeight: 100,
          locked: false,
          mirrored: false
        });
      });
      return trafficSplit;
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
    if (
      this.state.currentTab !== activeTab(tabName, defaultTab) ||
      prevProps.lastRefreshAt !== this.props.lastRefreshAt
    ) {
      this.setState({
        currentTab: activeTab(tabName, defaultTab)
      });
    }
  }

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

  doTrafficSplit = (manualOverride: WorkloadWeight[]) => {
    this.setState(_ => {
      return {
        manualOverride: manualOverride
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
      let newrafficSplit = new Map<string, string>();

      this.state.manualOverride.forEach((w, _) => {
        newrafficSplit.set(w.name, String(w.weight));
      });
      action.trafficSplit = Array.from(newrafficSplit);
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
        <RenderHeader
          location={this.props.location}
          rightToolbar={
            <RefreshContainer
              id="time_range_refresh"
              hideLabel={true}
              handleRefresh={this.doRefresh}
              manageURL={true}
            />
          }
          actionsToolbar={this.renderRightToolbar()}
        />
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
  duration: durationSelector(state),
  lastRefreshAt: state.globalState.lastRefreshAt
});

const ExperimentDetailsPageContainer = connect(mapStateToProps, null)(ExperimentDetailsPage);

export default ExperimentDetailsPageContainer;
