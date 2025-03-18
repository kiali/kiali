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
import { gvkType, IstioConfigList, skipUnrelatedK8sGateways, toIstioItems } from '../../types/IstioConfigList';
import { WorkloadPods } from './WorkloadPods';
import { IstioConfigCard } from '../../components/IstioConfigCard/IstioConfigCard';
import { MiniGraphCardPF } from 'pages/GraphPF/MiniGraphCardPF';
import { getGVKTypeString, stringToGVK } from '../../utils/IstioConfigUtils';
import { WorkloadEntries } from './WorkloadEntries';

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
  getGVKTypeString(gvkType.Gateway),
  getGVKTypeString(gvkType.K8sGateway),
  getGVKTypeString(gvkType.AuthorizationPolicy),
  getGVKTypeString(gvkType.PeerAuthentication),
  getGVKTypeString(gvkType.Sidecar),
  getGVKTypeString(gvkType.RequestAuthentication),
  getGVKTypeString(gvkType.EnvoyFilter),
  getGVKTypeString(gvkType.WorkloadGroup)
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
    // make sure workload selector is not empty, not to load all configs, this can happen when WorkloadGroup has no labels
    if (workloadSelector) {
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

    const istioAnnotations = serverConfig.istioAnnotations;
    const validations: Validations = {};

    if (workload.pods.length > 0) {
      validations.pod = {};

      workload.pods.forEach(pod => {
        validations.pod[pod.name] = {
          name: pod.name,
          objectGVK: stringToGVK('pod'),
          valid: true,
          checks: []
        };

        if (!isIstioNamespace(this.props.namespace) && !workload.isGateway) {
          if (!workload.isWaypoint) {
            if (
              (!pod.istioContainers || pod.istioContainers.length === 0) &&
              (!pod.istioInitContainers || pod.istioInitContainers.length === 0)
            ) {
              if (
                !(
                  serverConfig.ambientEnabled &&
                  (pod.annotations
                    ? pod.annotations[istioAnnotations.ambientAnnotation] === istioAnnotations.ambientAnnotationEnabled
                    : false)
                )
              ) {
                validations.pod[pod.name].checks.push(noIstiosidecar);
              }
            } else {
              pod.istioContainers?.forEach(c => {
                if (!c.isReady && validations.pod[pod.name].checks.indexOf(failingPodIstioContainer) === -1) {
                  validations.pod[pod.name].checks.push(failingPodIstioContainer);
                }
              });
              pod.istioInitContainers?.forEach(c => {
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

  render(): React.ReactNode {
    const workload = this.props.workload;
    const pods = workload?.pods ?? [];
    const workloadEntries = workload?.workloadEntries ?? [];

    const istioConfigItems = skipUnrelatedK8sGateways(
      this.state.workloadIstioConfig ? toIstioItems(this.state.workloadIstioConfig, workload?.cluster || '') : [],
      this.props.workload?.labels[serverConfig.istioLabels.ambientWaypointGatewayLabel]
    );

    // RenderComponentScroll handles height to provide an inner scroll combined with tabs
    // This height needs to be propagated to minigraph to proper resize in height
    // Graph resizes correctly on width
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
                  {this.props.workload?.gvk.Kind === gvkType.WorkloadGroup ? (
                    <WorkloadEntries
                      namespace={this.props.namespace}
                      workload={this.props.workload?.name || ''}
                      entries={workloadEntries}
                    />
                  ) : (
                    <WorkloadPods
                      namespace={this.props.namespace}
                      workload={this.props.workload?.name || ''}
                      pods={pods}
                      validations={this.state.validations?.pod || {}}
                    />
                  )}
                </StackItem>

                <StackItem style={{ paddingBottom: '20px' }}>
                  <IstioConfigCard
                    name={this.props.workload ? this.props.workload.name : ''}
                    items={istioConfigItems}
                  />
                </StackItem>
              </Stack>
            </GridItem>

            {includeMiniGraphPF && (
              <GridItem span={miniGraphSpan}>
                <MiniGraphCardPF
                  dataSource={this.graphDataSource}
                  namespace={this.props.namespace}
                  workload={this.props.workload}
                  refreshWorkload={this.props.refreshWorkload}
                />
              </GridItem>
            )}
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}
