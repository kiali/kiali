import * as React from 'react';
import { style } from 'typestyle';
import { Validations, ValidationTypes } from '../../types/IstioObjects';
import WorkloadDescription from './WorkloadInfo/WorkloadDescription';
import WorkloadPods from './WorkloadInfo/WorkloadPods';
import WorkloadServices from './WorkloadInfo/WorkloadServices';
import { validationToSeverity } from '../../types/ServiceInfo';
import { WorkloadHealth } from '../../types/Health';
import { Workload } from '../../types/Workload';
import { Grid, GridItem, Tab } from '@patternfly/react-core';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import Validation from '../../components/Validations/Validation';
import ErrorBoundaryWithMessage from '../../components/ErrorBoundary/ErrorBoundaryWithMessage';

type WorkloadInfoProps = {
  workload: Workload;
  validations: Validations;
  namespace: string;
  istioEnabled: boolean;
  health?: WorkloadHealth;
};

interface ValidationChecks {
  hasPodsChecks: boolean;
}

type WorkloadInfoState = {
  currentTab: string;
};

const tabIconStyle = style({
  fontSize: '0.9em'
});

const tabName = 'list';
const defaultTab = 'pods';
const paramToTab: { [key: string]: number } = {
  pods: 0,
  services: 1
};

class WorkloadInfo extends React.Component<WorkloadInfoProps, WorkloadInfoState> {
  constructor(props: WorkloadInfoProps) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab)
    };
  }

  componentDidUpdate() {
    const aTab = activeTab(tabName, defaultTab);

    if (this.state.currentTab !== aTab) {
      this.setState({
        currentTab: aTab
      });
    }
  }

  validationChecks(): ValidationChecks {
    const validationChecks = {
      hasPodsChecks: false
    };

    const pods = this.props.workload.pods || [];

    validationChecks.hasPodsChecks = pods.some(
      pod =>
        this.props.validations.pod &&
        this.props.validations.pod[pod.name] &&
        this.props.validations.pod[pod.name].checks.length > 0
    );

    return validationChecks;
  }

  errorBoundaryMessage(resourceName: string) {
    return `One of the ${resourceName} associated to this workload has an invalid format`;
  }

  render() {
    const workload = this.props.workload;
    const pods = workload.pods || [];
    const services = workload.services || [];
    const validationChecks = this.validationChecks();

    const getSeverityIcon: any = (severity: ValidationTypes = ValidationTypes.Error) => (
      <span className={tabIconStyle}>
        {' '}
        <Validation severity={severity} />
      </span>
    );

    const getValidationIcon = (keys: string[], type: string) => {
      let severity = ValidationTypes.Warning;
      keys.forEach(key => {
        const validations = this.props.validations![type][key];
        if (validationToSeverity(validations) === ValidationTypes.Error) {
          severity = ValidationTypes.Error;
        }
      });
      return getSeverityIcon(severity);
    };

    const podTabTitle: any = (
      <>
        Pods ({pods.length}){' '}
        {validationChecks.hasPodsChecks
          ? getValidationIcon((this.props.workload.pods || []).map(a => a.name), 'pod')
          : undefined}
      </>
    );

    return (
      <Grid style={{ margin: '30px' }} gutter={'md'}>
        <GridItem span={12}>
          <WorkloadDescription
            workload={workload}
            namespace={this.props.namespace}
            istioEnabled={this.props.istioEnabled}
            health={this.props.health}
          />
        </GridItem>
        <GridItem span={12}>
          <ParameterizedTabs
            id="service-tabs"
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue });
            }}
            tabMap={paramToTab}
            tabName={tabName}
            defaultTab={defaultTab}
            activeTab={this.state.currentTab}
          >
            <Tab title={podTabTitle} eventKey={0}>
              <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Pods')}>
                <WorkloadPods
                  namespace={this.props.namespace}
                  workload={this.props.workload.name}
                  pods={pods}
                  validations={this.props.validations!.pod}
                />
              </ErrorBoundaryWithMessage>
            </Tab>
            <Tab title={`Services (${services.length})`} eventKey={1}>
              <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Services')}>
                <WorkloadServices
                  services={services}
                  workload={this.props.workload.name}
                  namespace={this.props.namespace}
                />
              </ErrorBoundaryWithMessage>
            </Tab>
          </ParameterizedTabs>
        </GridItem>
      </Grid>
    );
  }
}

export default WorkloadInfo;
