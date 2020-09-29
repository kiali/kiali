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
import WorkloadWizardDropdown from '../../components/IstioWizards/WorkloadWizardDropdown';
import { serverConfig } from '../../config';
import { isIstioNamespace } from '../../config/ServerConfig';
import { IstioConfigList, toIstioItems } from '../../types/IstioConfigList';
import IstioConfigSubList from '../../components/IstioConfigSubList/IstioConfigSubList';
import TimeControlsContainer from '../../components/Time/TimeControls';

type WorkloadInfoProps = {
  namespace: string;
  workload?: Workload;
  duration: DurationInSeconds;
  refreshWorkload: () => void;
};

interface ValidationChecks {
  hasPodsChecks: boolean;
}

type WorkloadInfoState = {
  validations?: Validations;
  currentTab: string;
  health?: WorkloadHealth;
  threescaleRules: IstioRule[];
  workloadIstioConfig?: IstioConfigList;
};

const tabIconStyle = style({
  fontSize: '0.9em'
});

const tabName = 'list';
const defaultTab = 'pods';
const paramToTab: { [key: string]: number } = {
  pods: 0,
  services: 1,
  istioconfig: 2
};

const workloadIstioResources = [
  'gateways',
  'authorizationpolicies',
  'peerauthentications',
  'sidecars',
  'requestauthentications',
  'envoyfilters'
];

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

    // Fetch WorkloadInfo backend on duration changes or workload updates (reference comparison)
    if (prev.duration !== this.props.duration || prev.workload !== this.props.workload) {
      this.fetchBackend();
    }
  }

  private fetchBackend = () => {
    if (this.props.workload) {
      this.graphDataSource.fetchForWorkload(this.props.duration, this.props.namespace, this.props.workload.name);
      this.setState({
        validations: this.workloadValidations(this.props.workload)
      });
      API.getWorkloadHealth(
        this.props.namespace,
        this.props.workload.name,
        this.props.workload ? this.props.workload.type : '',
        this.props.duration,
        this.props.workload ? this.props.workload.istioSidecar : false
      )
        .then(health => this.setState({ health: health }))
        .catch(error => AlertUtils.addError('Could not fetch Health.', error));

      const labels = this.props.workload.labels;
      const wkLabels: string[] = [];
      Object.keys(labels).forEach(key => {
        const label = key + (labels[key] ? '=' + labels[key] : '');
        wkLabels.push(label);
      });
      const workloadSelector = wkLabels.join(',');
      API.getIstioConfig(this.props.namespace, workloadIstioResources, true, '', workloadSelector)
        .then(response => this.setState({ workloadIstioConfig: response.data }))
        .catch(error => AlertUtils.addError('Could not fetch Istio Config.', error));
    }
    if (serverConfig.extensions?.threescale.enabled) {
      // 3scale info should be placed under control plane namespace
      API.getIstioConfig(serverConfig.istioNamespace, ['rules'], false, 'kiali_wizard=threescale', '')
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

    const pods = this.props.workload?.pods || [];

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
    const workload = this.props.workload;
    const pods = workload?.pods || [];
    const services = workload?.services || [];
    const validationChecks = this.validationChecks();

    const getSeverityIcon: any = (severity: ValidationTypes = ValidationTypes.Error) => (
      <span className={tabIconStyle}>
        {' '}
        <Validation severity={severity} />
      </span>
    );

    const getIstioValidationIcon = (typeNames: { [key: string]: string[] }) => {
      let severity = ValidationTypes.Correct;
      if (this.state.workloadIstioConfig && this.state.workloadIstioConfig.validations) {
        const istioValidations = this.state.workloadIstioConfig.validations;
        Object.keys(istioValidations).forEach(type => {
          const typeValidations = istioValidations[type];
          Object.keys(typeValidations).forEach(name => {
            const nameValidation = typeValidations[name];
            if (typeNames[type] && typeNames[type].includes(name)) {
              const itemSeverity = validationToSeverity(nameValidation);
              if (
                (itemSeverity === ValidationTypes.Warning && severity !== ValidationTypes.Error) ||
                itemSeverity === ValidationTypes.Error
              ) {
                severity = itemSeverity;
              }
            }
          });
        });
      }
      return severity !== ValidationTypes.Correct ? getSeverityIcon(severity) : undefined;
    };

    const getWorkloadValidationIcon = (keys: string[], type: string) => {
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
          ? getWorkloadValidationIcon(
              pods.map(a => a.name),
              'pod'
            )
          : undefined}
      </>
    );

    const istioConfigItems = this.state.workloadIstioConfig ? toIstioItems(this.state.workloadIstioConfig) : [];
    let istioTabTitle: JSX.Element | undefined;
    let istioConfigIcon = undefined;
    // Helper to iterate at same time on workloadIstioConfig resources and validations
    const wkIstioTypes = [
      { field: 'gateways', validation: 'gateway' },
      { field: 'sidecars', validation: 'sidecar' },
      { field: 'envoyFilters', validation: 'envoyfilter' },
      { field: 'requestAuthentications', validation: 'requestauthentication' },
      { field: 'authorizationPolicies', validation: 'authorizationpolicy' },
      { field: 'peerAuthentications', validation: 'peerauthentication' }
    ];
    if (this.state.workloadIstioConfig?.validations) {
      const typeNames: { [key: string]: string[] } = {};
      wkIstioTypes.forEach(wkIstioType => {
        if (this.state.workloadIstioConfig && this.state.workloadIstioConfig.validations[wkIstioType.validation]) {
          typeNames[wkIstioType.validation] = [];
          this.state.workloadIstioConfig[wkIstioType.field]?.forEach(r =>
            typeNames[wkIstioType.validation].push(r.metadata.name)
          );
        }
      });
      istioConfigIcon = getIstioValidationIcon(typeNames);
    }
    istioTabTitle = (
      <>
        Istio Config ({istioConfigItems.length}){istioConfigIcon}
      </>
    );
    return (
      <>
        <RightActionBar>
          <TimeControlsContainer
            key={'DurationDropdown'}
            id="worload-info-duration-dropdown"
            handleRefresh={this.props.refreshWorkload}
            disabled={false}
          />
          {workload && (
            <WorkloadWizardDropdown
              namespace={this.props.namespace}
              workload={workload}
              rules={this.state.threescaleRules}
              onChange={this.props.refreshWorkload}
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
                      workload={this.props.workload?.name || ''}
                      pods={pods}
                      validations={this.state.validations?.pod || {}}
                    />
                  </ErrorBoundaryWithMessage>
                </Tab>
                <Tab title={`Services (${services.length})`} eventKey={1}>
                  <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Services')}>
                    <WorkloadServices
                      services={services}
                      workload={this.props.workload?.name || ''}
                      namespace={this.props.namespace}
                    />
                  </ErrorBoundaryWithMessage>
                </Tab>
                <Tab title={istioTabTitle} eventKey={2}>
                  <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Istio Config')}>
                    <IstioConfigSubList name={this.props.workload?.name || ''} items={istioConfigItems} />
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
