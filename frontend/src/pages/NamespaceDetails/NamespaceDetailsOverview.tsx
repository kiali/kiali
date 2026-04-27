import * as React from 'react';
import {
  Card,
  CardBody,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Flex,
  FlexItem,
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
import { NamespaceInfo } from 'types/NamespaceInfo';
import { ControlPlaneBadge } from 'components/Badge/ControlPlaneBadge';
import { DataPlaneBadge } from 'components/Badge/DataPlaneBadge';
import { NotPartOfMeshBadge } from 'components/Badge/NotPartOfMeshBadge';
import { NamespaceMTLSStatus } from 'components/MTls/NamespaceMTLSStatus';
import { ValidationSummary } from 'components/Validations/ValidationSummary';
import { ValidationSummaryLink } from 'components/Link/ValidationSummaryLink';
import { KialiLink } from 'components/Link/KialiLink';
import { Paths, isMultiCluster } from 'config';
import { URLParam } from 'app/History';
import { getNamespaceModeInfo, isDataPlaneNamespace } from 'utils/NamespaceUtils';
import { t } from 'utils/I18nUtils';
import { getNamespaceRevisions } from 'components/VirtualList/Renderers';
import { isRevisionAvailable } from 'pages/Namespaces/NamespaceRevisionUtils';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';
import { infoStyle } from 'styles/IconStyle';
import { Label } from 'components/Label/Label';
import { flexFillStyle } from 'styles/FlexStyles';

type Props = {
  duration: DurationInSeconds;
  namespace: string;
  nsInfo: NamespaceInfo;
};

const gridStyle = kialiStyle({
  alignItems: 'stretch',
  flex: 1,
  marginTop: '1rem',
  minHeight: 0
});

/** Same as Service/App info: one scrollbar for the whole left column, not inside CardBody. */
const overviewLeftColumnStyle = kialiStyle({
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: '0.5rem'
});

const revisionWarningIconStyle = kialiStyle({
  verticalAlign: 'middle'
});

const buildListLink = (path: string, ns: string, cluster?: string): string => {
  const params = new URLSearchParams();
  params.set(URLParam.NAMESPACES, ns);
  if (cluster && isMultiCluster) {
    params.set(URLParam.CLUSTERNAME, cluster);
  }
  return `${path}?${params.toString()}`;
};

const NamespaceRevisionLabels: React.FC<{ ns: NamespaceInfo }> = ({ ns }) => {
  const revisions = getNamespaceRevisions(ns);
  const revAvailable = isRevisionAvailable(ns);

  if (revisions.length === 0) {
    return !ns.isControlPlane ? (
      <PFLabel variant="outline" color="grey">
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

export class NamespaceDetailsOverview extends React.Component<Props> {
  private graphDataSource = new GraphDataSource();

  constructor(props: Props) {
    super(props);
  }

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

    const graphLink = `/graph/namespaces?namespaces=${encodeURIComponent(namespace)}`;
    const appsLink = buildListLink(`/${Paths.APPLICATIONS}`, namespace, cluster);
    const workloadsLink = buildListLink(`/${Paths.WORKLOADS}`, namespace, cluster);
    const servicesLink = buildListLink(`/${Paths.SERVICES}`, namespace, cluster);
    const istioLink = buildListLink(`/${Paths.ISTIO}`, namespace, cluster);

    return (
      <Card>
        <CardBody>
          <Flex direction={{ default: 'column' }} gap={{ default: 'gapMd' }}>
            <FlexItem>
              <DescriptionList>
                <DescriptionListGroup>
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
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Mode')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <PFLabel variant="outline" color={modeInfo.color} isCompact>
                      {t(modeInfo.displayText)}
                    </PFLabel>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {(revisions.length > 0 || !nsInfo.isControlPlane) && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Revision')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <NamespaceRevisionLabels ns={nsInfo} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                {nsInfo.tlsStatus && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('mTLS')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <NamespaceMTLSStatus status={nsInfo.tlsStatus.status} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Istio config')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <ValidationSummaryLink
                      namespace={namespace}
                      objectCount={validations.objectCount}
                      errors={validations.errors}
                      warnings={validations.warnings}
                    >
                      <ValidationSummary
                        id={`ns-detail-val-${namespace}`}
                        errors={validations.errors}
                        warnings={validations.warnings}
                        objectCount={validations.objectCount}
                        type="istio"
                      />
                    </ValidationSummaryLink>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </FlexItem>

            <FlexItem>
              <Title headingLevel="h4" size={TitleSizes.md}>
                {t('Navigate')}
              </Title>
              <Flex gap={{ default: 'gapSm' }} flexWrap={{ default: 'wrap' }}>
                <KialiLink to={graphLink}>{t('Traffic graph')}</KialiLink>
                <span aria-hidden="true">·</span>
                <KialiLink to={appsLink}>{t('Applications')}</KialiLink>
                <span aria-hidden="true">·</span>
                <KialiLink to={workloadsLink}>{t('Workloads')}</KialiLink>
                <span aria-hidden="true">·</span>
                <KialiLink to={servicesLink}>{t('Services')}</KialiLink>
                <span aria-hidden="true">·</span>
                <KialiLink to={istioLink}>{t('Istio config')}</KialiLink>
              </Flex>
            </FlexItem>

            {nsInfo.labels && Object.keys(nsInfo.labels).length > 0 && (
              <FlexItem>
                <Title headingLevel="h4" size={TitleSizes.md}>
                  {t('Labels')}
                </Title>
                <Flex gap={{ default: 'gapSm' }} flexWrap={{ default: 'wrap' }}>
                  {Object.entries(nsInfo.labels).map(([key, value]) => (
                    <Label key={`${key}=${value}`} name={key} value={value} />
                  ))}
                </Flex>
              </FlexItem>
            )}

            {nsInfo.annotations && Object.keys(nsInfo.annotations).length > 0 && (
              <FlexItem>
                <Divider />
                <Title headingLevel="h4" size={TitleSizes.md} style={{ marginTop: '1rem' }}>
                  {t('Annotations')}
                </Title>
                <DescriptionList>
                  {Object.entries(nsInfo.annotations).map(([key, value]) => (
                    <DescriptionListGroup key={key}>
                      <DescriptionListTerm>{key}</DescriptionListTerm>
                      <DescriptionListDescription>{value}</DescriptionListDescription>
                    </DescriptionListGroup>
                  ))}
                </DescriptionList>
              </FlexItem>
            )}
          </Flex>
        </CardBody>
      </Card>
    );
  }

  render(): React.ReactNode {
    const { namespace } = this.props;
    const miniGraphSpan = 8;

    return (
      <div className={flexFillStyle}>
        <div data-test={`namespace-detail-overview-${namespace}`}>
          <Grid hasGutter={true} className={gridStyle} style={{ alignItems: 'stretch' }}>
            <GridItem span={4} className={overviewLeftColumnStyle}>
              <Stack hasGutter={true}>
                <StackItem>{this.renderLeftCard()}</StackItem>
              </Stack>
            </GridItem>
            <GridItem span={miniGraphSpan}>
              <MiniGraphCard dataSource={this.graphDataSource} />
            </GridItem>
          </Grid>
        </div>
      </div>
    );
  }
}
