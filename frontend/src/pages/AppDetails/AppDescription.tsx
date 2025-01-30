import * as React from 'react';
import { App } from '../../types/App';
import { Alert, Card, CardBody, CardHeader, Title, TitleSizes, TooltipPosition } from '@patternfly/react-core';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { isMultiCluster, serverConfig } from '../../config';
import { Labels } from '../../components/Label/Labels';
import { kialiStyle } from 'styles/StyleUtils';
import * as H from '../../types/Health';
import { HealthIndicator } from '../../components/Health/HealthIndicator';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { AmbientLabel, tooltipMsgType } from '../../components/Ambient/AmbientLabel';

type AppDescriptionProps = {
  app?: App;
  health?: H.Health;
  isSupported?: boolean;
};

const iconStyle = kialiStyle({
  display: 'inline-block'
});

const healthIconStyle = kialiStyle({
  marginLeft: '0.5rem',
  verticalAlign: '-0.075rem'
});

export const AppDescription: React.FC<AppDescriptionProps> = (props: AppDescriptionProps) => {
  const appLabels: { [key: string]: string } = {};

  if (props.app) {
    appLabels[serverConfig.istioLabels.appLabelName] = props.app.name;
  }

  return props.app ? (
    <Card id="AppDescriptionCard" data-test="app-description-card">
      <CardHeader>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <div key="service-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.App} position={TooltipPosition.top} />
          </div>

          {props.app.name}

          <span className={healthIconStyle}>
            <HealthIndicator id={props.app.name} health={props.health} />
          </span>

          {props.app.isAmbient && <AmbientLabel tooltip={tooltipMsgType.app} />}
        </Title>

        {props.app.cluster && isMultiCluster && (
          <div key="cluster-icon" style={{ paddingBottom: '0.5rem' }}>
            <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {props.app.cluster}
          </div>
        )}
        {!props.isSupported && (
          <Alert
            variant="info"
            isInline={true}
            title="Limited information supplied due to the referenced workload type"
            style={{ marginTop: '0.25rem' }}
          />
        )}
      </CardHeader>
      <CardBody>
        <Labels
          labels={appLabels}
          tooltipMessage={`Workloads and Services grouped by ${serverConfig.istioLabels.appLabelName} label`}
        />

        <DetailDescription
          namespace={props.app ? props.app.namespace.name : ''}
          workloads={props.app ? props.app.workloads : []}
          services={props.app ? props.app.serviceNames : []}
          health={props.health}
          cluster={props.app?.cluster}
        />
      </CardBody>
    </Card>
  ) : (
    <>Loading</>
  );
};
