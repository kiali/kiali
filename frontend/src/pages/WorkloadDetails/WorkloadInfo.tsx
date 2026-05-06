import * as React from 'react';
import * as API from '../../services/Api';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Grid,
  GridItem,
  Stack,
  StackItem,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import { ObjectCheck, Validations, ValidationTypes } from '../../types/IstioObjects';
import { WorkloadHealth } from '../../types/Health';
import { Workload } from '../../types/Workload';
import { activeTab } from '../../components/Tab/Tabs';
import { detailGridStyle, detailLeftColumnStyle, flexFillStyle } from 'styles/FlexStyles';
import { GraphDataSource } from '../../services/GraphDataSource';
import { DurationInSeconds } from 'types/Common';
import { isIstioNamespace, serverConfig, getAppLabelName } from '../../config/ServerConfig';
import {
  gvkType,
  IstioConfigList,
  skipUnrelatedK8sGateways,
  toIstioItems,
  validationKey
} from '../../types/IstioConfigList';
import { WorkloadPods } from './WorkloadPods';
import { IstioConfigCard } from '../../components/IstioConfigCard/IstioConfigCard';
import { MiniGraphCard } from 'pages/Graph/MiniGraphCard';
import { getGVKTypeString, isGVKSupported, stringToGVK } from '../../utils/IstioConfigUtils';
import { WorkloadEntries } from './WorkloadEntries';
import { Spire } from '../../components/Spire/Spire';
import { HealthStatusPopover } from '../../components/Health/HealthStatusPopover';
import { LocalTime } from '../../components/Time/LocalTime';
import { TextOrLink } from '../../components/Link/TextOrLink';
import { renderAPILogo, renderRuntimeLogo } from '../../components/Logo/Logos';
import { hasMissingSidecar } from 'components/VirtualList/Config';
import { MissingSidecar } from '../../components/MissingSidecar/MissingSidecar';
import { MissingLabel } from '../../components/MissingLabel/MissingLabel';
import { AmbientLabel, tooltipMsgType } from '../../components/Ambient/AmbientLabel';
import { renderWaypointSimpleLabel } from '../../components/Ambient/WaypointLabel';
import { WorkloadConfigValidation } from '../../components/Validations/WorkloadConfigValidation';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { EditableAnnotationsCard } from '../../components/Label/EditableAnnotationsCard';
import { EditableLabelsCard } from '../../components/Label/EditableLabelsCard';
import { Paths } from '../../config';
import { navigateToFilteredList, buildWorkloadMetadataPatch } from '../PageUtils';
import { t } from 'utils/I18nUtils';
import { addError, addSuccess } from '../../utils/AlertUtils';

type WorkloadInfoProps = {
  duration: DurationInSeconds;
  health?: WorkloadHealth;
  namespace: string;
  refreshWorkload: () => void;
  workload?: Workload;
};

type WorkloadInfoState = {
  currentTab: string;
  validations?: Validations;
  workloadIstioConfig?: IstioConfigList;
};

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
  getGVKTypeString(gvkType.WorkloadGroup),
  getGVKTypeString(gvkType.K8sInferencePool)
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
        .catch(error => addError('Could not fetch Health/IstioConfig.', error));
    }
  };

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

  private renderDetailsCard(workload: Workload): React.ReactNode {
    const runtimes = (workload.runtimes ?? []).map(r => r.name).filter(name => name !== '');

    return (
      <StackItem key="details">
        <Card data-test="workload-details-card" isCompact>
          <CardBody>
            <DescriptionList columnModifier={{ default: '2Col' }} isCompact>
              {workload.cluster && (
                <DescriptionListGroup data-test="details-cluster">
                  <DescriptionListTerm>{t('Cluster')}</DescriptionListTerm>
                  <DescriptionListDescription>{workload.cluster}</DescriptionListDescription>
                </DescriptionListGroup>
              )}

              <DescriptionListGroup data-test="details-status">
                <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <HealthStatusPopover health={this.props.health} />
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup data-test="details-created">
                <DescriptionListTerm>{t('Created')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <LocalTime time={workload.createdAt} />
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup data-test="details-type">
                <DescriptionListTerm>{t('Type')}</DescriptionListTerm>
                <DescriptionListDescription>{workload.gvk.Kind || 'N/A'}</DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup data-test="details-version">
                <DescriptionListTerm>{t('Version')}</DescriptionListTerm>
                <DescriptionListDescription>{workload.resourceVersion}</DescriptionListDescription>
              </DescriptionListGroup>

              {workload.istioInjectionAnnotation !== undefined && (
                <DescriptionListGroup data-test="details-istio-injection">
                  <DescriptionListTerm>{t('Istio Injection')}</DescriptionListTerm>
                  <DescriptionListDescription>{String(workload.istioInjectionAnnotation)}</DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {!isGVKSupported(workload.gvk) && (
                <DescriptionListGroup data-test="details-api-version">
                  <DescriptionListTerm>{t('API Version')}</DescriptionListTerm>
                  <DescriptionListDescription>{`${workload.gvk.Group}.${workload.gvk.Version}`}</DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {workload.additionalDetails.map((additionalItem, idx) => (
                <DescriptionListGroup key={`additional-${idx}`}>
                  <DescriptionListTerm>
                    {additionalItem.title}
                    {additionalItem.icon && renderAPILogo(additionalItem.icon, undefined, idx)}
                  </DescriptionListTerm>
                  <DescriptionListDescription>
                    <TextOrLink text={additionalItem.value} urlTruncate={64} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              ))}

              {runtimes.length > 0 && (
                <DescriptionListGroup data-test="details-runtimes">
                  <DescriptionListTerm>{t('Runtimes')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {runtimes
                      .map((rt, idx) => renderRuntimeLogo(rt, idx))
                      .reduce(
                        (list: React.ReactNode[], elem) =>
                          list.length > 0 ? [...list, <span key="sep"> | </span>, elem] : [elem],
                        []
                      )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>

            {hasMissingSidecar(workload) && (
              <MissingSidecar
                dataTest={`missing-sidecar-badge-for-${workload.name}-workload-in-${this.props.namespace}-namespace`}
                tooltip={true}
                text=""
              />
            )}

            {workload.isAmbient && !workload.isWaypoint && (
              <AmbientLabel
                tooltip={tooltipMsgType.workload}
                waypoint={workload.waypointWorkloads && workload.waypointWorkloads.length > 0 ? true : false}
              />
            )}

            {(!workload.appLabel || !workload.versionLabel) &&
              !workload.isWaypoint &&
              !workload.spireInfo?.isSpireServer && (
                <MissingLabel missingApp={!workload.appLabel} missingVersion={!workload.versionLabel} tooltip={true} />
              )}

            {workload.isWaypoint && renderWaypointSimpleLabel()}

            {!isGVKSupported(workload.gvk) && (
              <Alert
                variant="info"
                isInline={true}
                title={t('Kiali can only supply limited information for this workload type')}
                style={{ marginTop: '0.5rem' }}
              />
            )}

            <WorkloadConfigValidation
              validations={workload.validations?.['workload']?.[validationKey(workload.name, workload.namespace)]}
              namespace={this.props.namespace}
              iconSize={'md'}
              detailed={true}
            />
          </CardBody>
        </Card>
      </StackItem>
    );
  }

  private renderResourcesCard(workload: Workload): React.ReactNode {
    const apps: string[] = [];
    const services: string[] = [];

    if (!workload.isWaypoint && !workload.isZtunnel) {
      const appLabelName = getAppLabelName(workload.labels);
      if (appLabelName) {
        apps.push(workload.labels[appLabelName]);
      }
    }

    workload.services?.forEach(s => services.push(s.name));

    return (
      <StackItem key="resources">
        <Card data-test="workload-resources-card" isCompact>
          <CardHeader>
            <Title headingLevel="h4" size={TitleSizes.md}>
              {t('Resources')}
            </Title>
          </CardHeader>
          <CardBody>
            <DetailDescription
              namespace={this.props.namespace}
              apps={apps.length > 0 ? apps : undefined}
              services={services}
              cluster={workload.cluster}
              isWaypoint={workload.isWaypoint}
              waypointWorkloads={!workload.isWaypoint ? workload.waypointWorkloads : []}
            />
          </CardBody>
        </Card>
      </StackItem>
    );
  }

  private handleSaveMetadata = (field: 'labels' | 'annotations', updated: Record<string, string>): void => {
    const workload = this.props.workload;
    if (!workload) {
      return;
    }
    const original = (field === 'labels' ? workload.labels : workload.annotations) ?? {};
    const jsonPatch = buildWorkloadMetadataPatch(field, original, updated, workload.gvk.Kind);

    API.updateWorkload(this.props.namespace, workload.name, workload.gvk, jsonPatch, undefined, workload.cluster)
      .then(() => {
        addSuccess(t('Workload {{workload}} {{field}} updated', { workload: workload.name, field }));
        this.props.refreshWorkload();
      })
      .catch(error => {
        addError(t('Could not update workload {{workload}} {{field}}', { workload: workload.name, field }), error);
      });
  };

  private renderLabelsCard(workload: Workload): React.ReactNode {
    return (
      <StackItem key="labels" data-test="workload-labels-card">
        <EditableLabelsCard
          canEdit={!serverConfig.deployment.viewOnlyMode}
          isVertical={false}
          labels={workload.labels ?? {}}
          numLabels={999}
          onLabelClick={(key, value) => navigateToFilteredList(Paths.WORKLOADS, key, value, this.props.namespace)}
          onSave={labels => this.handleSaveMetadata('labels', labels)}
          prioritizeIstio
          title={t('Labels')}
        />
      </StackItem>
    );
  }

  private renderAnnotationsCard(workload: Workload): React.ReactNode {
    return (
      <StackItem key="annotations" data-test="workload-annotations-card">
        <EditableAnnotationsCard
          annotations={workload.annotations ?? {}}
          canEdit={!serverConfig.deployment.viewOnlyMode}
          onSave={annotations => this.handleSaveMetadata('annotations', annotations)}
          prioritizeIstio
          prioritizeIstioCount
          title={t('Annotations')}
        />
      </StackItem>
    );
  }

  render(): React.ReactNode {
    const workload = this.props.workload;
    const pods = workload?.pods ?? [];
    const workloadEntries = workload?.workloadEntries ?? [];

    const istioConfigItems = skipUnrelatedK8sGateways(
      this.state.workloadIstioConfig ? toIstioItems(this.state.workloadIstioConfig, workload?.cluster || '') : [],
      this.props.workload?.labels[serverConfig.istioLabels.ambientWaypointGatewayLabel]
    );

    const miniGraphSpan = 8;

    return (
      <>
        <div className={flexFillStyle}>
          <Grid hasGutter={true} className={detailGridStyle}>
            <GridItem span={4} className={detailLeftColumnStyle}>
              <Stack style={{ gap: '0.5rem' }}>
                {workload && this.renderDetailsCard(workload)}
                {workload && this.renderResourcesCard(workload)}
                {workload && this.renderLabelsCard(workload)}
                {workload && this.renderAnnotationsCard(workload)}

                {workload && workload?.spireInfo?.isSpireManaged && (
                  <StackItem>
                    <Spire object={workload} objectType="workload" />
                  </StackItem>
                )}

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

            <GridItem span={miniGraphSpan}>
              <MiniGraphCard
                dataSource={this.graphDataSource}
                namespace={this.props.namespace}
                workload={this.props.workload}
                refreshWorkload={this.props.refreshWorkload}
              />
            </GridItem>
          </Grid>
        </div>
      </>
    );
  }
}
