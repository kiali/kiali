import * as React from 'react';

import ParameterizedTabs, { activeTab } from '../../../../components/Tab/Tabs';
import { Link, RouteComponentProps } from 'react-router-dom';
import { RenderHeader } from '../../../../components/Nav/Page';
import {
  Breadcrumb,
  BreadcrumbItem,
  Card,
  CardBody,
  Stack,
  StackItem,
  Tab,
  Text,
  TextVariants,
  Title
} from '@patternfly/react-core';
import { style } from 'typestyle';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import { ExperimentAction, Iter8ExpDetailsInfo } from '../../../../types/Iter8';
import Iter8Dropdown from './Iter8Dropdown';
import history from '../../../../app/History';
import * as FilterHelper from '../../../../components/FilterList/FilterHelper';
import { connect } from 'react-redux';

import ExperimentInfoDescription from './ExperimentInfoDescription';
import CriteriaInfoDescription from './CriteriaInfoDescription';
import { KialiAppState } from '../../../../store/Store';
import { durationSelector } from '../../../../store/Selectors';
import { PfColors } from '../../../../components/Pf/PfColors';
import { DurationInSeconds } from '../../../../types/Common';
import RefreshContainer from '../../../../components/Refresh/Refresh';

interface ExpeerimentId {
  namespace: string;
  name: string;
}

interface Props extends RouteComponentProps<ExpeerimentId> {
  duration: DurationInSeconds;
}

interface State {
  experiment?: Iter8ExpDetailsInfo;
  currentTab: string;
  canDelete: boolean;
  target: string;
  baseline: string;
  candidate: string;
  actionTaken: string;
  resetActionFlag: boolean;
}

const tabName = 'tab';
const defaultTab = 'overview';

const tabIndex: { [tab: string]: number } = {
  info: 0,
  criteria: 1
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
    this.state = {
      experiment: undefined,
      canDelete: false,
      currentTab: activeTab(tabName, defaultTab),
      target: urlParams.get('target') || '',
      baseline: urlParams.get('baseline') || '',
      candidate: urlParams.get('candidate') || '',
      actionTaken: '',
      resetActionFlag: false
    };
  }

  fetchExperiment = () => {
    const namespace = this.props.match.params.namespace;
    const name = this.props.match.params.name;
    API.getIter8Info()
      .then(result => {
        const iter8Info = result.data;
        if (iter8Info.enabled) {
          API.getExperiment(namespace, name)
            .then(result => {
              if (this.state.resetActionFlag) {
                this.setState({
                  actionTaken: '',
                  experiment: result.data,
                  canDelete: result.data.permissions.delete,
                  resetActionFlag: false
                });
              } else {
                this.setState({
                  experiment: result.data,
                  canDelete: result.data.permissions.delete,
                  resetActionFlag: true
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

  componentDidUpdate() {
    if (this.state.currentTab !== activeTab(tabName, defaultTab)) {
      this.setState(
        {
          currentTab: activeTab(tabName, defaultTab)
        },
        () => this.doRefresh()
      );
    }
  }
  // Extensions breadcrumb,
  // It is a simplified view of BreadcrumbView with fixed rendering
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

  renderOverview = () => {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody>
          <Title headingLevel="h3" size="2xl">
            {' '}
            Target Service{' '}
          </Title>
          <Stack>
            <StackItem id={'targetService'}>
              <Text component={TextVariants.h3}> Service </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.targetService : ''}
            </StackItem>
            <StackItem id={'baseline'}>
              <Text component={TextVariants.h3}> Baseline / Traffic Split</Text>
              {this.state.experiment
                ? this.state.experiment.experimentItem.baseline +
                  ' / ' +
                  this.state.experiment.experimentItem.baselinePercentage +
                  ' % '
                : ''}
            </StackItem>
            <StackItem id={'candidate'}>
              <Text component={TextVariants.h3}> Candidate / Traffic Split</Text>
              {this.state.experiment
                ? this.state.experiment.experimentItem.candidate +
                  ' / ' +
                  this.state.experiment.experimentItem.candidatePercentage +
                  ' % '
                : ''}
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
    );
  };

  renderTrafficControl = () => {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody>
          <Title headingLevel="h3" size="2xl">
            {' '}
            Traffic Control{' '}
          </Title>
          <Stack>
            <StackItem id={'strategy'}>
              <Text component={TextVariants.h3}> Strategy </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.algorithm : ''}
            </StackItem>
            <StackItem id={'maxIterations'}>
              <Text component={TextVariants.h3}> Max Iterations </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.maxIterations : ''}
            </StackItem>
            <StackItem id={'maxTrafficPercentage'}>
              <Text component={TextVariants.h3}> Max Traffic Percentage </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.maxTrafficPercentage : ''}
            </StackItem>
            <StackItem id={'trafficStepSide'}>
              <Text component={TextVariants.h3}> Traffic Step Side </Text>
              {this.state.experiment ? this.state.experiment.trafficControl.trafficStepSize : ''}
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
    );
  };

  renderStatus = () => {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody>
          <Title headingLevel="h3" size="2xl">
            {' '}
            Status{' '}
          </Title>
          <Stack>
            <StackItem id={'phase'}>
              <Text component={TextVariants.h3}> Phase </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.phase : ''}
            </StackItem>
            <StackItem id={'status'}>
              <Text component={TextVariants.h3}> Status </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.status : ''}
            </StackItem>
            <StackItem id={'started'}>
              <Text component={TextVariants.h3}> Started </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.startedAt : ''}
            </StackItem>
            <StackItem id={'ended'}>
              <Text component={TextVariants.h3}> Ended </Text>
              {this.state.experiment ? this.state.experiment.experimentItem.endedAt : ''}
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
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

  doIter8Action = (requestAction: string): void => {
    let errMsg = 'Could not' + requestAction + ' Iter8 Experiment';
    const action: ExperimentAction = {
      action: requestAction
    };
    this.setState({ actionTaken: requestAction });
    API.updateExperiment(this.props.match.params.namespace, this.props.match.params.name, JSON.stringify(action))
      .then(() => this.doRefresh())
      .catch(error => {
        this.setState({ actionTaken: '' });
        AlertUtils.addError(errMsg, error);
      });
  };

  canAction = (action: string): boolean => {
    switch (action) {
      case 'Completed':
        return (
          this.state.experiment !== undefined &&
          this.state.experiment.experimentItem.startedAt !== 0 &&
          this.state.experiment.experimentItem.endedAt === 0
        );
    }
    return (
      this.state.experiment !== undefined &&
      this.state.experiment.experimentItem.startedAt !== 0 &&
      this.state.experiment.experimentItem.phase === action
    );
  };

  renderRightToolbar = () => {
    return (
      <span style={{ position: 'absolute', right: '20px', zIndex: 1 }}>
        <RefreshContainer id="time_range_refresh" hideLabel={true} handleRefresh={this.doRefresh} manageURL={true} />
        <Iter8Dropdown
          experimentName={this.props.match.params.name}
          canDelete={this.state.canDelete}
          startedAt={this.state.experiment ? this.state.experiment.experimentItem.startedAt : 0}
          endedAt={this.state.experiment ? this.state.experiment.experimentItem.endedAt : 0}
          phase={this.state.experiment ? this.state.experiment.experimentItem.phase : ' '}
          onDelete={this.doDelete}
          onResume={() => this.doIter8Action('resume')}
          onPause={() => this.doIter8Action('pause')}
          onSuccess={() => this.doIter8Action('override_success')}
          onFailure={() => this.doIter8Action('override_failure')}
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
          baseline={this.state.baseline}
          candidate={this.state.candidate}
          actionTaken={this.state.actionTaken}
        />
      </Tab>
    );
    const criteriaTab = (
      <Tab eventKey={1} title="Criteria" key="Criteria">
        <CriteriaInfoDescription criterias={this.state.experiment ? this.state.experiment.criterias : []} />
      </Tab>
    );
    const tabsArray: any[] = [overviewTab, criteriaTab];
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
          mountOnEnter={false}
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
