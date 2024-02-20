import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { ObjectCheck, Validations, ValidationTypes } from '../../types/IstioObjects';
import { WorkloadDescription } from './WorkloadDescription';
import { WorkloadHealth } from '../../types/Health';
import { Workload } from '../../types/Workload';
import { Grid, GridItem, Stack, StackItem } from '@patternfly/react-core';
import { activeTab } from '../../components/Tab/Tabs';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { GraphDataSource } from '../../services/GraphDataSource';
import { DurationInSeconds } from 'types/Common';
import { isIstioNamespace, serverConfig } from '../../config/ServerConfig';
import { IstioConfigList, toIstioItems } from '../../types/IstioConfigList';
import { WorkloadPods } from './WorkloadPods';
import { GraphEdgeTapEvent } from '../../components/CytoscapeGraph/CytoscapeGraph';
import { history, URLParam } from '../../app/History';
import { MiniGraphCard } from '../../components/CytoscapeGraph/MiniGraphCard';
import { IstioConfigCard } from '../../components/IstioConfigCard/IstioConfigCard';
import { MiniGraphCardPF } from 'pages/GraphPF/MiniGraphCardPF';
import { isGateway } from '../../helpers/LabelFilterHelper';

type WorkloadInfoProps = {
  duration: DurationInSeconds;
  health?: WorkloadHealth;
  namespace: string;
  refreshWorkload: () => void;
  workload?: Workload;
};

type WorkloadInfoState = {
  currentTab: string;
  tabHeight?: number;
  validations?: Validations;
  workloadIstioConfig?: IstioConfigList;
};

const fullHeightStyle = kialiStyle({
  height: '100%'
});

const tabName = 'list';
const defaultTab = 'pods';

const workloadIstioResources = [
  'gateways',
  'authorizationpolicies',
  'peerauthentications',
  'sidecars',
  'requestauthentications',
  'envoyfilters'
];

export class WorkloadInfo extends React.Component<WorkloadInfoProps, WorkloadInfoState> {
  private graphDataSource = new GraphDataSource();

  constructor(props: WorkloadInfoProps) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab)
    };
  }

  componentDidMount(): void {
    this.fetchBackend();
  }

  componentDidUpdate(prev: WorkloadInfoProps): void {
    // Fetch WorkloadInfo backend on duration changes or WorkloadDetailsPage update
    if (prev.duration !== this.props.duration || this.props.workload !== prev.workload) {
      this.fetchBackend();
    }
  }

  private fetchBackend = (): void => {
    if (!this.props.workload) {
      return;
    }
    this.graphDataSource.fetchForWorkload(
      this.props.duration,
      this.props.namespace,
      this.props.workload.name,
      this.props.workload.cluster
    );
    this.setState({
      validations: this.workloadValidations(this.props.workload)
    });
    const labels = this.props.workload.labels;
    const wkLabels: string[] = [];
    Object.keys(labels).forEach(key => {
      const label = `${key}${labels[key] ? `=${labels[key]}` : ''}`;
      wkLabels.push(label);
    });
    const workloadSelector = wkLabels.join(',');

    API.getIstioConfig(
      this.props.namespace,
      workloadIstioResources,
      true,
      '',
      workloadSelector,
      this.props.workload.cluster
    )
      .then(results => {
        this.setState({ workloadIstioConfig: results.data });
      })
      .catch(error => AlertUtils.addError('Could not fetch Health/IstioConfig.', error));
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
    const failingPodContainer: ObjectCheck = {
      message: 'Pod has failing container',
      severity: ValidationTypes.Warning,
      path: ''
    };
    const failingPodIstioContainer: ObjectCheck = {
      message: 'Pod has failing Istio container',
      severity: ValidationTypes.Warning,
      path: ''
    };
    const failingPodAppContainer: ObjectCheck = {
      message: 'Pod has failing app container',
      severity: ValidationTypes.Warning,
      path: ''
    };

    const validations: Validations = {};
    const isWaypoint =
      serverConfig.ambientEnabled === true &&
      workload.labels &&
      workload.labels['gateway.istio.io/managed'] === 'istio.io-mesh-controller';

    if (workload.pods.length > 0) {
      validations.pod = {};
      workload.pods.forEach(pod => {
        validations.pod[pod.name] = {
          name: pod.name,
          objectType: 'pod',
          valid: true,
          checks: []
        };
        if (!isIstioNamespace(this.props.namespace) && !isGateway(this.props.workload?.labels || {})) {
          if (!isWaypoint) {
            if (!pod.istioContainers || pod.istioContainers.length === 0) {
              if (
                !(
                  serverConfig.ambientEnabled === true &&
                  (pod.annotations ? pod.annotations['ambient.istio.io/redirection'] === 'enabled' : false)
                )
              ) {
                validations.pod[pod.name].checks.push(noIstiosidecar);
              }
            } else {
              pod.istioContainers.forEach(c => {
                if (!c.isReady && validations.pod[pod.name].checks.indexOf(failingPodIstioContainer) === -1) {
                  validations.pod[pod.name].checks.push(failingPodIstioContainer);
                }
              });
            }
            if (!pod.containers || pod.containers.length === 0) {
              validations.pod[pod.name].checks.push(failingPodContainer);
            } else {
              pod.containers.forEach(c => {
                if (!c.isReady && validations.pod[pod.name].checks.indexOf(failingPodAppContainer) === -1) {
                  validations.pod[pod.name].checks.push(failingPodAppContainer);
                }
              });
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
        // If statusReason is present
        if (pod.statusReason) {
          validations.pod[pod.name].checks.push({
            message: pod.statusReason,
            severity: ValidationTypes.Warning,
            path: ''
          });
        }
        validations.pod[pod.name].valid = validations.pod[pod.name].checks.length === 0;
      });
    }
    return validations;
  }

  goToMetrics = (e: GraphEdgeTapEvent): void => {
    if (e.source !== e.target && this.props.workload) {
      const direction = e.source === this.props.workload.name ? 'outbound' : 'inbound';
      const destination = direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service';
      const urlParams = new URLSearchParams(history.location.search);
      urlParams.set('tab', direction === 'inbound' ? 'in_metrics' : 'out_metrics');
      urlParams.set(
        URLParam.BY_LABELS,
        `${destination}=${e.source === this.props.workload.name ? e.target : e.source}`
      );
      history.replace(`${history.location.pathname}?${urlParams.toString()}`);
    }
  };

  render(): React.ReactNode {
    const workload = this.props.workload;
    const pods = workload?.pods || [];
    const istioConfigItems = this.state.workloadIstioConfig
      ? toIstioItems(this.state.workloadIstioConfig, workload?.cluster || '')
      : [];
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
    }

    // RenderComponentScroll handles height to provide an inner scroll combined with tabs
    // This height needs to be propagated to minigraph to proper resize in height
    // Graph resizes correctly on width
    const height = this.state.tabHeight ? this.state.tabHeight - 115 : 300;
    const graphContainerStyle = kialiStyle({ width: '100%', height: height });
    const includeMiniGraphCy = serverConfig.kialiFeatureFlags.uiDefaults.graph.impl !== 'pf';
    const includeMiniGraphPF = serverConfig.kialiFeatureFlags.uiDefaults.graph.impl !== 'cy';
    const miniGraphSpan = includeMiniGraphCy && includeMiniGraphPF ? 4 : 8;

    return (
      <>
        <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
          <Grid hasGutter={true} className={fullHeightStyle}>
            <GridItem span={4}>
              <Stack hasGutter={true}>
                <StackItem>
                  <WorkloadDescription
                    workload={workload}
                    health={this.props.health}
                    namespace={this.props.namespace}
                  />
                </StackItem>
                <StackItem>
                  <WorkloadPods
                    namespace={this.props.namespace}
                    workload={this.props.workload?.name || ''}
                    pods={pods}
                    validations={this.state.validations?.pod || {}}
                  />
                </StackItem>
                <StackItem style={{ paddingBottom: '20px' }}>
                  <IstioConfigCard
                    name={this.props.workload ? this.props.workload.name : ''}
                    items={istioConfigItems}
                  />
                </StackItem>
              </Stack>
            </GridItem>
            {includeMiniGraphCy && (
              <GridItem span={miniGraphSpan}>
                <MiniGraphCard
                  onEdgeTap={this.goToMetrics}
                  dataSource={this.graphDataSource}
                  graphContainerStyle={graphContainerStyle}
                />
              </GridItem>
            )}
            {includeMiniGraphPF && (
              <GridItem span={miniGraphSpan}>
                <MiniGraphCardPF dataSource={this.graphDataSource} />
              </GridItem>
            )}
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}
