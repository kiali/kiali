import * as React from 'react';
import { style } from 'typestyle';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { IstioRule, ObjectCheck, Validations, ValidationTypes } from '../../types/IstioObjects';
import WorkloadDescription from './WorkloadInfo/WorkloadDescription';
import WorkloadPods from './WorkloadInfo/WorkloadPods';
import WorkloadServices from './WorkloadInfo/WorkloadServices';
import { validationToSeverity } from '../../types/ServiceInfo';
import { WorkloadHealth } from '../../types/Health';
import { Workload } from '../../types/Workload';
import { Grid, GridItem, Tab } from '@patternfly/react-core';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { RenderComponentScroll } from '../../components/Nav/Page';
import Validation from '../../components/Validations/Validation';
import ErrorBoundaryWithMessage from '../../components/ErrorBoundary/ErrorBoundaryWithMessage';
import GraphDataSource from '../../services/GraphDataSource';
import { DurationInSeconds } from 'types/Common';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';
import { DurationDropdownContainer } from 'components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from 'components/Refresh/RefreshButton';
import WorkloadWizardDropdown from '../../components/IstioWizards/WorkloadWizardDropdown';
import { serverConfig } from '../../config';
import { isIstioNamespace } from '../../config/ServerConfig';

type WorkloadInfoProps = {
  namespace: string;
  workloadName: string;
  duration: DurationInSeconds;
};

interface ValidationChecks {
  hasPodsChecks: boolean;
}

type WorkloadInfoState = {
  workload?: Workload;
  validations?: Validations;
  currentTab: string;
  health?: WorkloadHealth;
  threescaleRules: IstioRule[];
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
  private graphDataSource = new GraphDataSource();

  constructor(props: WorkloadInfoProps) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab),
      threescaleRules: []
    };
  }

  componentDidMount() {
    this.fetchBackend();
  }

  componentDidUpdate(prev: WorkloadInfoProps) {
    const aTab = activeTab(tabName, defaultTab);

    if (this.state.currentTab !== aTab) {
      this.setState({
        currentTab: aTab
      });
    }

    if (prev.duration !== this.props.duration) {
      this.fetchBackend();
    }
  }

  private fetchBackend = () => {
    this.graphDataSource.fetchForWorkload(this.props.duration, this.props.namespace, this.props.workloadName);
    API.getWorkload(this.props.namespace, this.props.workloadName)
      .then(details =>
        this.setState({
          workload: details.data,
          validations: this.workloadValidations(details.data)
        })
      )
      .catch(error => AlertUtils.addError('Could not fetch Workload.', error));
    API.getWorkloadHealth(
      this.props.namespace,
      this.props.workloadName,
      this.state.workload ? this.state.workload.type : '',
      this.props.duration,
      this.state.workload ? this.state.workload.istioSidecar : false
    )
      .then(health => this.setState({ health: health }))
      .catch(error => AlertUtils.addError('Could not fetch Health.', error));
    if (serverConfig.extensions?.threescale.enabled) {
      // 3scale info should be placed under control plane namespace
      API.getIstioConfig(serverConfig.istioNamespace, ['rules'], false, 'kiali_wizard=threescale')
        .then(response => {
          this.setState({
            threescaleRules: response.data.rules
          });
        })
        .catch(error => {
          AlertUtils.addError('Could not fetch 3scale Rules.', error);
        });
    }
  };

  // All information for validations is fetched in the workload, no need to add another call
  private workloadValidations(workload: Workload): Validations {
    const noIstiosidecar: ObjectCheck = {
      message: 'Pod has no Istio sidecar',
      severity: ValidationTypes.Warning,
      path: ''
    };
    const noAppLabel: ObjectCheck = { message: 'Pod has no app label', severity: ValidationTypes.Warning, path: '' };
    const noVersionLabel: ObjectCheck = {
      message: 'Pod has no version label',
      severity: ValidationTypes.Warning,
      path: ''
    };
    const pendingPod: ObjectCheck = { message: 'Pod is in Pending Phase', severity: ValidationTypes.Warning, path: '' };
    const unknownPod: ObjectCheck = { message: 'Pod is in Unknown Phase', severity: ValidationTypes.Warning, path: '' };
    const failedPod: ObjectCheck = { message: 'Pod is in Failed Phase', severity: ValidationTypes.Error, path: '' };

    const validations: Validations = {};
    if (workload.pods.length > 0) {
      validations.pod = {};
      workload.pods.forEach(pod => {
        validations.pod[pod.name] = {
          name: pod.name,
          objectType: 'pod',
          valid: true,
          checks: []
        };
        if (!isIstioNamespace(this.props.namespace)) {
          if (!pod.istioContainers || pod.istioContainers.length === 0) {
            validations.pod[pod.name].checks.push(noIstiosidecar);
          }
          if (!pod.labels) {
            validations.pod[pod.name].checks.push(noAppLabel);
            validations.pod[pod.name].checks.push(noVersionLabel);
          } else {
            if (!pod.appLabel) {
              validations.pod[pod.name].checks.push(noAppLabel);
            }
            if (!pod.versionLabel) {
              validations.pod[pod.name].checks.push(noVersionLabel);
            }
          }
        }
        switch (pod.status) {
          case 'Pending':
            validations.pod[pod.name].checks.push(pendingPod);
            break;
          case 'Unknown':
            validations.pod[pod.name].checks.push(unknownPod);
            break;
          case 'Failed':
            validations.pod[pod.name].checks.push(failedPod);
            break;
          default:
          // Pod healthy
        }
        validations.pod[pod.name].valid = validations.pod[pod.name].checks.length === 0;
      });
    }
    return validations;
  }

  private validationChecks(): ValidationChecks {
    const validationChecks = {
      hasPodsChecks: false
    };

    const pods = this.state.workload?.pods || [];

    validationChecks.hasPodsChecks = pods.some(
      pod =>
        this.state.validations?.pod &&
        this.state.validations.pod[pod.name] &&
        this.state.validations.pod[pod.name].checks.length > 0
    );

    return validationChecks;
  }

  private errorBoundaryMessage(resourceName: string) {
    return `One of the ${resourceName} associated to this workload has an invalid format`;
  }

  render() {
    const workload = this.state.workload;
    const pods = workload?.pods || [];
    const services = workload?.services || [];
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
        const validations = this.state.validations![type][key];
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
          ? getValidationIcon(
              pods.map(a => a.name),
              'pod'
            )
          : undefined}
      </>
    );

    return (
      <>
        <RightActionBar>
          <DurationDropdownContainer id="workload-info-duration-dropdown" prefix="Last" />
          <RefreshButtonContainer handleRefresh={this.fetchBackend} />
          {workload && (
            <WorkloadWizardDropdown
              namespace={this.props.namespace}
              workload={workload}
              rules={this.state.threescaleRules}
              onChange={this.fetchBackend}
            />
          )}
        </RightActionBar>
        <RenderComponentScroll>
          <Grid style={{ margin: '10px' }} gutter={'md'}>
            <GridItem span={12}>
              <WorkloadDescription
                workload={workload}
                namespace={this.props.namespace}
                health={this.state.health}
                miniGraphDataSource={this.graphDataSource}
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
                      workload={this.state.workload?.name || ''}
                      pods={pods}
                      validations={this.state.validations?.pod || {}}
                    />
                  </ErrorBoundaryWithMessage>
                </Tab>
                <Tab title={`Services (${services.length})`} eventKey={1}>
                  <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Services')}>
                    <WorkloadServices
                      services={services}
                      workload={this.state.workload?.name || ''}
                      namespace={this.props.namespace}
                    />
                  </ErrorBoundaryWithMessage>
                </Tab>
              </ParameterizedTabs>
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}

export default WorkloadInfo;
