import * as React from 'react';
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
import { App } from '../../types/App';
import { Spire } from '../../components/Spire/Spire';
import { detailCardStackStyle, detailGridStyle, detailLeftColumnStyle, flexFillStyle } from 'styles/FlexStyles';
import { DurationInSeconds } from 'types/Common';
import { GraphDataSource } from 'services/GraphDataSource';
import { AppHealth } from 'types/Health';
import { MiniGraphCard } from 'pages/Graph/MiniGraphCard';
import { HealthStatusPopover } from '../../components/Health/HealthStatusPopover';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { ModeBadge } from '../../components/Badge/ModeBadge';
import { t } from 'utils/I18nUtils';

type AppInfoProps = {
  app?: App;
  duration: DurationInSeconds;
  health?: AppHealth;
  isSupported?: boolean;
};

export class AppInfo extends React.Component<AppInfoProps> {
  private graphDataSource = new GraphDataSource();

  componentDidMount(): void {
    this.fetchBackend();
  }

  componentWillUnmount(): void {
    this.graphDataSource.destroy();
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
        <Card data-test="app-details-card" isCompact>
          <CardBody>
            <DescriptionList columnModifier={{ default: '2Col' }} isCompact>
              {app.cluster && (
                <DescriptionListGroup data-test="details-cluster">
                  <DescriptionListTerm>{t('Cluster')}</DescriptionListTerm>
                  <DescriptionListDescription>{app.cluster}</DescriptionListDescription>
                </DescriptionListGroup>
              )}

              <DescriptionListGroup data-test="details-status">
                <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <HealthStatusPopover health={this.props.health} />
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup data-test="details-mode">
                <DescriptionListTerm>{t('Mode')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <ModeBadge
                    isAmbient={app.isAmbient}
                    istioSidecar={app.workloads?.some(w => w.istioSidecar) ?? false}
                    popoverMessage={
                      app.isAmbient
                        ? t(
                            "All of this App's Workloads are in the Ambient Mesh. For more information, see the Workload details."
                          )
                        : undefined
                    }
                  />
                </DescriptionListDescription>
              </DescriptionListGroup>
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
        <Card data-test="app-resources-card" isCompact>
          <CardHeader>
            <Title headingLevel="h4" size={TitleSizes.md}>
              {t('Related')}
            </Title>
          </CardHeader>
          <CardBody>
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
        <Grid hasGutter={true} className={detailGridStyle}>
          <GridItem span={4} className={detailLeftColumnStyle}>
            <Stack className={detailCardStackStyle}>
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
