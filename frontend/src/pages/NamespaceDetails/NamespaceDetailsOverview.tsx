import * as React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Grid,
  GridItem,
  Label as PFLabel,
  Stack,
  StackItem,
  Title,
  TitleSizes,
  Tooltip
} from '@patternfly/react-core';
import { GraphDataSource } from 'services/GraphDataSource';
import { MiniGraphCard } from 'pages/Graph/MiniGraphCard';
import { DurationInSeconds } from 'types/Common';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { DEGRADED, FAILURE, HEALTHY, NA, NOT_READY, Status } from 'types/Health';
import { ControlPlaneBadge } from 'components/Badge/ControlPlaneBadge';
import { DataPlaneBadge } from 'components/Badge/DataPlaneBadge';
import { NotPartOfMeshBadge } from 'components/Badge/NotPartOfMeshBadge';
import { NamespaceMTLSStatus } from 'components/MTls/NamespaceMTLSStatus';
import { KialiLink } from 'components/Link/KialiLink';
import { Paths, isMultiCluster } from 'config';
import { router, URLParam } from 'app/History';
import { getNamespaceModeInfo, isDataPlaneNamespace } from 'utils/NamespaceUtils';
import { t } from 'utils/I18nUtils';
import { getNamespaceRevisions } from 'components/VirtualList/Renderers';
import { isRevisionAvailable } from 'pages/Namespaces/NamespaceRevisionUtils';
import { KialiIcon, createIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';
import { infoStyle } from 'styles/IconStyle';
import { EditableAnnotationsCard } from 'components/Label/EditableAnnotationsCard';
import { EditableLabelsCard } from 'components/Label/EditableLabelsCard';
import { NamespaceHealthStatus } from 'pages/Namespaces/NamespaceHealthStatus';
import { NamespaceAction } from 'pages/Namespaces/NamespaceActions';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { detailLeftColumnStyle, flexFillStyle } from 'styles/FlexStyles';

type Props = {
  canEdit: boolean;
  duration: DurationInSeconds;
  namespace: string;
  namespaceActions?: NamespaceAction[];
  nsInfo: NamespaceInfo;
  onSaveAnnotations: (annotations: Record<string, string>) => void;
  onSaveLabels: (labels: Record<string, string>) => void;
};

const gridStyle = kialiStyle({
  alignItems: 'stretch',
  flex: 1,
  marginTop: '1rem',
  minHeight: 0
});

const revisionWarningIconStyle = kialiStyle({
  verticalAlign: 'middle'
});

const buildListLink = (path: string, ns: string, cluster?: string, healthFilter?: string): string => {
  const params = new URLSearchParams();
  params.set(URLParam.NAMESPACES, ns);
  if (cluster && isMultiCluster) {
    params.set(URLParam.CLUSTERNAME, cluster);
  }
  if (healthFilter) {
    params.set('health', healthFilter);
  }
  return `${path}?${params.toString()}`;
};

const navigateGridStyle = kialiStyle({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: '1rem',
  rowGap: '0.35rem',
  alignItems: 'center',
  whiteSpace: 'nowrap'
});

const healthBreakdownStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.75rem',
  fontSize: '0.85rem',
  whiteSpace: 'nowrap'
});

const healthItemStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  whiteSpace: 'nowrap'
});

const renderHealthBreakdown = (
  path: string,
  ns: string,
  cluster: string | undefined,
  status?: NamespaceStatus
): React.ReactNode => {
  if (!status) {
    return null;
  }

  const items: { count: number; status: Status }[] = [
    { count: status.inError.length, status: FAILURE },
    { count: status.inWarning.length, status: DEGRADED },
    { count: status.inNotReady.length, status: NOT_READY },
    { count: status.inSuccess.length, status: HEALTHY },
    { count: status.notAvailable.length, status: NA }
  ].filter(item => item.count > 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={healthBreakdownStyle}>
      {items.map((item, idx) => (
        <React.Fragment key={item.status.id}>
          {idx > 0 && (
            <span style={{ borderLeft: '1px solid var(--pf-t--global--border--color--default)', height: '1rem' }} />
          )}
          <KialiLink
            to={buildListLink(path, ns, cluster, item.status.name)}
            onClick={() => FilterSelected.resetFilters()}
            className={healthItemStyle}
          >
            {createIcon(item.status)} {item.count} {item.status.name}
          </KialiLink>
        </React.Fragment>
      ))}
    </div>
  );
};

const buildIstioFilteredLink = (ns: string, cluster: string | undefined, configFilter: string): string => {
  const params = new URLSearchParams();
  params.set(URLParam.NAMESPACES, ns);
  if (cluster && isMultiCluster) {
    params.set(URLParam.CLUSTERNAME, cluster);
  }
  params.set('config', configFilter);
  return `/${Paths.ISTIO}?${params.toString()}`;
};

const renderValidationBreakdown = (
  ns: string,
  cluster: string | undefined,
  validations?: { errors: number; objectCount?: number; warnings: number }
): React.ReactNode => {
  if (!validations || !validations.objectCount || validations.objectCount === 0) {
    return null;
  }

  const valid = validations.objectCount - validations.errors - validations.warnings;
  const items: { configFilter: string; count: number; status: Status }[] = [
    { count: validations.errors, status: FAILURE, configFilter: 'Not Valid' },
    { count: validations.warnings, status: DEGRADED, configFilter: 'Warning' },
    { count: valid, status: HEALTHY, configFilter: 'Valid' }
  ].filter(item => item.count > 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={healthBreakdownStyle}>
      {items.map((item, idx) => (
        <React.Fragment key={item.status.id}>
          {idx > 0 && (
            <span style={{ borderLeft: '1px solid var(--pf-t--global--border--color--default)', height: '1rem' }} />
          )}
          <KialiLink
            to={buildIstioFilteredLink(ns, cluster, item.configFilter)}
            onClick={() => FilterSelected.resetFilters()}
            className={healthItemStyle}
          >
            {createIcon(item.status)} {item.count} {item.status.name}
          </KialiLink>
        </React.Fragment>
      ))}
    </div>
  );
};

const NamespaceRevisionLabels: React.FC<{ ns: NamespaceInfo }> = ({ ns }) => {
  const revisions = getNamespaceRevisions(ns);
  const revAvailable = isRevisionAvailable(ns);

  if (revisions.length === 0) {
    return !ns.isControlPlane ? (
      <PFLabel variant="outline" color="grey" isCompact>
        {t('Not applicable')}
      </PFLabel>
    ) : null;
  }

  return (
    <>
      {revisions.map((rev, idx) => (
        <Tooltip
          key={`${ns.name}-rev-${idx}`}
          content={
            <span>
              {!revAvailable
                ? t('Control plane with revision "{{version}}" does not exist', { version: rev })
                : t('Istio revision {{version}}', { version: rev })}
            </span>
          }
        >
          <PFLabel
            variant="outline"
            color={!revAvailable ? 'red' : 'orange'}
            isCompact
            data-test={idx === 0 ? 'data-plane-revision-badge' : undefined}
            style={idx > 0 ? { marginLeft: '0.25rem' } : undefined}
            icon={
              !revAvailable ? <KialiIcon.Warning className={classes(infoStyle, revisionWarningIconStyle)} /> : undefined
            }
          >
            {rev}
          </PFLabel>
        </Tooltip>
      ))}
    </>
  );
};

const partitionByIstio = (entries: Record<string, string>): { numPriority: number; sorted: Record<string, string> } => {
  const keys = Object.keys(entries);
  const istioKeys = keys.filter(k => k.toLowerCase().includes('istio')).sort();
  const otherKeys = keys.filter(k => !k.toLowerCase().includes('istio')).sort();
  const sorted: Record<string, string> = {};
  for (const k of [...istioKeys, ...otherKeys]) {
    sorted[k] = entries[k];
  }
  return { sorted, numPriority: istioKeys.length };
};

export class NamespaceDetailsOverview extends React.Component<Props> {
  private graphDataSource = new GraphDataSource();

  componentDidMount(): void {
    this.fetchGraph();
  }

  componentDidUpdate(prev: Props): void {
    if (
      prev.duration !== this.props.duration ||
      prev.namespace !== this.props.namespace ||
      prev.nsInfo.cluster !== this.props.nsInfo.cluster
    ) {
      this.fetchGraph();
    }
  }

  private fetchGraph = (): void => {
    this.graphDataSource.fetchForNamespace(this.props.duration, this.props.namespace, this.props.nsInfo.cluster);
  };

  private renderLeftCard(): React.ReactNode {
    const { namespace, nsInfo } = this.props;
    const cluster = nsInfo.cluster;
    const isDataPlane = isDataPlaneNamespace(nsInfo);
    const modeInfo = getNamespaceModeInfo(nsInfo);
    const revisions = getNamespaceRevisions(nsInfo);
    let validations = nsInfo.validations;
    if (!validations) {
      validations = { namespace: nsInfo.name, objectCount: 0, errors: 0, warnings: 0 };
    }

    const appsLink = buildListLink(`/${Paths.APPLICATIONS}`, namespace, cluster);
    const workloadsLink = buildListLink(`/${Paths.WORKLOADS}`, namespace, cluster);
    const servicesLink = buildListLink(`/${Paths.SERVICES}`, namespace, cluster);
    const istioLink = buildListLink(`/${Paths.ISTIO}`, namespace, cluster);

    const statusCount = (s?: {
      inError: string[];
      inNotReady: string[];
      inSuccess: string[];
      inWarning: string[];
      notAvailable: string[];
    }): number | undefined =>
      s
        ? s.inError.length + s.inNotReady.length + s.inSuccess.length + s.inWarning.length + s.notAvailable.length
        : undefined;
    const appCount = statusCount(nsInfo.statusApp);
    const serviceCount = statusCount(nsInfo.statusService);
    const workloadCount = statusCount(nsInfo.statusWorkload);
    const istioCount = validations.objectCount && validations.objectCount > 0 ? validations.objectCount : undefined;

    return (
      <>
        <StackItem key="details">
          <Card data-test="namespace-details-card" isCompact>
            <CardBody>
              <DescriptionList columnModifier={{ default: '2Col' }} isCompact>
                {cluster && (
                  <DescriptionListGroup data-test="details-cluster">
                    <DescriptionListTerm>{t('Cluster')}</DescriptionListTerm>
                    <DescriptionListDescription>{cluster}</DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                <DescriptionListGroup data-test="details-status">
                  <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <NamespaceHealthStatus
                      inlineIssueCount
                      name={namespace}
                      statusApp={nsInfo.statusApp}
                      statusService={nsInfo.statusService}
                      statusWorkload={nsInfo.statusWorkload}
                      worstStatus={nsInfo.worstStatus ?? NA.id}
                    />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {(revisions.length > 0 || !nsInfo.isControlPlane) && (
                  <DescriptionListGroup data-test="details-revision">
                    <DescriptionListTerm>{t('Revision')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <NamespaceRevisionLabels ns={nsInfo} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                <DescriptionListGroup data-test="details-mode">
                  <DescriptionListTerm>{t('Mode')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <PFLabel variant="outline" color={modeInfo.color} isCompact>
                      {t(modeInfo.displayText)}
                    </PFLabel>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup data-test="details-type">
                  <DescriptionListTerm>{t('Type')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {nsInfo.isControlPlane ? (
                      <ControlPlaneBadge />
                    ) : isDataPlane ? (
                      <DataPlaneBadge />
                    ) : (
                      <NotPartOfMeshBadge />
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {nsInfo.tlsStatus && (
                  <DescriptionListGroup data-test="details-mtls">
                    <DescriptionListTerm>{t('mTLS')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <NamespaceMTLSStatus status={nsInfo.tlsStatus.status} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
              </DescriptionList>
            </CardBody>
          </Card>
        </StackItem>

        <StackItem key="resources">
          <Card data-test="namespace-resources-card" isCompact>
            <CardHeader>
              <Title headingLevel="h4" size={TitleSizes.md}>
                {t('Resources')}
              </Title>
            </CardHeader>
            <CardBody>
              <div className={navigateGridStyle}>
                <KialiLink to={appsLink}>
                  {t('Applications')}
                  {appCount !== undefined && ` (${appCount})`}
                </KialiLink>
                <div>{renderHealthBreakdown(`/${Paths.APPLICATIONS}`, namespace, cluster, nsInfo.statusApp)}</div>

                <KialiLink to={servicesLink}>
                  {t('Services')}
                  {serviceCount !== undefined && ` (${serviceCount})`}
                </KialiLink>
                <div>{renderHealthBreakdown(`/${Paths.SERVICES}`, namespace, cluster, nsInfo.statusService)}</div>

                <KialiLink to={workloadsLink}>
                  {t('Workloads')}
                  {workloadCount !== undefined && ` (${workloadCount})`}
                </KialiLink>
                <div>{renderHealthBreakdown(`/${Paths.WORKLOADS}`, namespace, cluster, nsInfo.statusWorkload)}</div>

                <KialiLink to={istioLink}>
                  {t('Istio config')}
                  {istioCount !== undefined && ` (${istioCount})`}
                </KialiLink>
                <div>{renderValidationBreakdown(namespace, cluster, validations)}</div>
              </div>
            </CardBody>
          </Card>
        </StackItem>

        <StackItem key="labels" data-test="namespace-labels-card">
          {(() => {
            const { sorted, numPriority } = partitionByIstio(nsInfo.labels ?? {});
            return (
              <EditableLabelsCard
                canEdit={this.props.canEdit}
                labels={sorted}
                numLabels={numPriority}
                onLabelClick={(key, value) => {
                  FilterSelected.resetFilters();
                  const params = new URLSearchParams();
                  params.set('namespaceLabel', `${key}=${value}`);
                  router.navigate(`/${Paths.NAMESPACES}?${params.toString()}`);
                }}
                onSave={this.props.onSaveLabels}
                title={t('Labels')}
              />
            );
          })()}
        </StackItem>

        <StackItem key="annotations" data-test="namespace-annotations-card">
          {(() => {
            const { sorted, numPriority } = partitionByIstio(nsInfo.annotations ?? {});
            return (
              <EditableAnnotationsCard
                annotations={sorted}
                canEdit={this.props.canEdit}
                numAnnotations={numPriority}
                onSave={this.props.onSaveAnnotations}
                title={t('Annotations')}
              />
            );
          })()}
        </StackItem>
      </>
    );
  }

  render(): React.ReactNode {
    const { namespace } = this.props;
    const miniGraphSpan = 8;

    return (
      <>
        <div className={flexFillStyle} data-test={`namespace-detail-overview-${namespace}`}>
          <Grid hasGutter={true} className={gridStyle}>
            <GridItem span={4} className={detailLeftColumnStyle}>
              <Stack style={{ gap: '0.5rem' }}>{this.renderLeftCard()}</Stack>
            </GridItem>
            <GridItem span={miniGraphSpan}>
              <MiniGraphCard dataSource={this.graphDataSource} namespaceActions={this.props.namespaceActions} />
            </GridItem>
          </Grid>
        </div>
      </>
    );
  }
}
