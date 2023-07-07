import * as React from 'react';
import { App } from '../../types/App';
import { Card, CardBody, CardHeader, Title, TitleSizes, TooltipPosition } from '@patternfly/react-core';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { isMultiCluster, serverConfig } from '../../config';
import { Labels } from '../../components/Label/Labels';
import { kialiStyle } from 'styles/StyleUtils';
import * as H from '../../types/Health';
import { HealthIndicator } from '../../components/Health/HealthIndicator';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';

type AppDescriptionProps = {
  app?: App;
  health?: H.Health;
};

const iconStyle = kialiStyle({
  margin: '0 0 0 0',
  padding: '0 0 0 0',
  display: 'inline-block',
  verticalAlign: '2px !important'
});

const healthIconStyle = kialiStyle({
  marginLeft: '10px',
  verticalAlign: '-1px !important'
});

export class AppDescription extends React.Component<AppDescriptionProps> {
  render() {
    const appLabels: { [key: string]: string } = {};
    if (this.props.app) {
      appLabels[serverConfig.istioLabels.appLabelName] = this.props.app.name;
    }
    return this.props.app ? (
      <Card id={'AppDescriptionCard'} data-test="app-description-card">
        <CardHeader style={{ display: 'table' }}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            <div key="service-icon" className={iconStyle}>
              <PFBadge badge={PFBadges.App} position={TooltipPosition.top} />
            </div>
            {this.props.app.name}
            <span className={healthIconStyle}>
              <HealthIndicator id={this.props.app.name} health={this.props.health} />
            </span>
          </Title>
          {this.props.app.cluster && isMultiCluster() && (
            <div key="cluster-icon" style={{ paddingBottom: '10px' }}>
              <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {this.props.app.cluster}
            </div>
          )}
        </CardHeader>
        <CardBody>
          <Labels
            labels={appLabels}
            tooltipMessage={'Workloads and Services grouped by ' + serverConfig.istioLabels.appLabelName + ' label'}
          />
          <DetailDescription
            namespace={this.props.app ? this.props.app.namespace.name : ''}
            workloads={this.props.app ? this.props.app.workloads : []}
            services={this.props.app ? this.props.app.serviceNames : []}
            health={this.props.health}
            cluster={this.props.app?.cluster}
          />
        </CardBody>
      </Card>
    ) : (
      'Loading'
    );
  }
}
