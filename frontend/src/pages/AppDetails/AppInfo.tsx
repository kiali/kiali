import * as React from 'react';
import {
  Alert,
  Card,
  CardBody,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Grid,
  GridItem,
  Stack,
  StackItem,
  Popover,
  PopoverPosition,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import { App } from '../../types/App';
import { Spire } from '../../components/Spire/Spire';
import { detailLeftColumnStyle, flexFillStyle } from 'styles/FlexStyles';
import { DurationInSeconds } from 'types/Common';
import { GraphDataSource } from 'services/GraphDataSource';
import { AppHealth } from 'types/Health';
import { kialiStyle } from 'styles/StyleUtils';
import { MiniGraphCard } from 'pages/Graph/MiniGraphCard';
import { createIcon } from '../../config/KialiIcon';
import * as H from '../../types/Health';
import { NA, HEALTHY } from '../../types/Health';
import { HealthDetails } from '../../components/Health/HealthDetails';
import { AmbientLabel, tooltipMsgType } from '../../components/Ambient/AmbientLabel';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { t } from 'utils/I18nUtils';

type AppInfoProps = {
  app?: App;
  duration: DurationInSeconds;
  health?: AppHealth;
  isSupported?: boolean;
};

const gridStyle = kialiStyle({
  alignItems: 'stretch',
  flex: 1,
  marginTop: '1rem',
  minHeight: 0
});

const renderHealthStatus = (health?: H.Health): React.ReactNode => {
  const status = health ? health.getStatus() : NA;
  const isUnhealthy = health && status !== HEALTHY && status !== NA;

  const statusContent = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        cursor: isUnhealthy ? 'pointer' : undefined
      }}
    >
      {createIcon(status)}
      {status.name}
    </span>
  );

  if (isUnhealthy) {
    return (
      <Popover
        aria-label="Health details"
        position={PopoverPosition.right}
        triggerAction="click"
        showClose={true}
        headerContent={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {createIcon(status)} <strong>{status.name}</strong>
          </span>
        }
        bodyContent={<HealthDetails health={health!} />}
      >
        {statusContent}
      </Popover>
    );
  }

  return statusContent;
};

export class AppInfo extends React.Component<AppInfoProps> {
  private graphDataSource = new GraphDataSource();

  componentDidMount(): void {
    this.fetchBackend();
  }

  componentDidUpdate(prev: AppInfoProps): void {
    if (this.props.duration !== prev.duration || this.props.app !== prev.app) {
      this.fetchBackend();
    }
  }

  private fetchBackend = (): void => {
    if (!this.props.app) {
      return;
    }

    this.graphDataSource.fetchForVersionedApp(
      this.props.duration,
      this.props.app.namespace.name,
      this.props.app.name,
      this.props.app.cluster
    );
  };

  private renderDetailsCard(app: App): React.ReactNode {
    return (
      <StackItem key="details">
        <Card data-test="app-details-card">
          <CardBody>
            <DescriptionList columnModifier={{ default: '2Col' }}>
              {app.cluster && (
                <DescriptionListGroup data-test="details-cluster">
                  <DescriptionListTerm>{t('Cluster')}</DescriptionListTerm>
                  <DescriptionListDescription>{app.cluster}</DescriptionListDescription>
                </DescriptionListGroup>
              )}

              <DescriptionListGroup data-test="details-status">
                <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                <DescriptionListDescription>{renderHealthStatus(this.props.health)}</DescriptionListDescription>
              </DescriptionListGroup>

              {app.isAmbient && (
                <DescriptionListGroup data-test="details-ambient">
                  <DescriptionListTerm>{t('Mesh')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <AmbientLabel tooltip={tooltipMsgType.app} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>

            {!this.props.isSupported && (
              <Alert
                variant="info"
                isInline={true}
                title={t('Limited info is supplied due to the referenced workload type')}
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </CardBody>
        </Card>
      </StackItem>
    );
  }

  private renderResourcesCard(app: App): React.ReactNode {
    return (
      <StackItem key="resources">
        <Card data-test="app-resources-card">
          <CardBody>
            <Title headingLevel="h4" size={TitleSizes.md} style={{ marginBottom: '0.5rem' }}>
              {t('Resources')}
            </Title>
            <DetailDescription
              namespace={app.namespace.name}
              workloads={app.workloads}
              services={app.serviceNames}
              cluster={app.cluster}
            />
          </CardBody>
        </Card>
      </StackItem>
    );
  }

  render(): React.ReactNode {
    const app = this.props.app;
    const miniGraphSpan = 8;

    return (
      <div className={flexFillStyle}>
        <Grid hasGutter={true} className={gridStyle}>
          <GridItem span={4} className={detailLeftColumnStyle}>
            <Stack hasGutter={true}>
              {app && this.renderDetailsCard(app)}
              {app && this.renderResourcesCard(app)}
              {app &&
                app.workloads &&
                app.workloads.length > 0 &&
                app.workloads.some(w => w.spireInfo?.isSpireManaged) && (
                  <StackItem>
                    <Spire object={app} objectType="app" />
                  </StackItem>
                )}
            </Stack>
          </GridItem>

          <GridItem span={miniGraphSpan}>
            <MiniGraphCard dataSource={this.graphDataSource} />
          </GridItem>
        </Grid>
      </div>
    );
  }
}
