import { Label, Stack, StackItem, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Labels } from 'components/Label/Labels';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { LocalTime } from 'components/Time/LocalTime';
import { ValidationObjectSummary } from 'components/Validations/ValidationObjectSummary';
import { GVKToBadge } from 'components/VirtualList/Config';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { IstioConfigDetails } from 'types/IstioConfigDetails';
import {
  HelpMessage,
  ObjectReference,
  ObjectValidation,
  ServiceReference,
  ValidationMessage,
  ValidationTypes,
  WorkloadReference
} from 'types/IstioObjects';
import { kialiStyle } from 'styles/StyleUtils';
import { getIstioObject, getIstioObjectGVK, getReconciliationCondition, gvkToString } from 'utils/IstioConfigUtils';
import { IstioConfigHelp } from './IstioConfigHelp';
import { IstioConfigReferences } from './IstioConfigReferences';
import { IstioConfigValidationReferences } from './IstioConfigValidationReferences';
import { IstioStatusMessageList } from './IstioStatusMessageList';
import { KioskElement } from '../../../components/Kiosk/KioskElement';
import { PFColors } from '../../../components/Pf/PfColors';
import { GetIstioObjectUrl } from '../../../components/Link/IstioObjectLink';
import { homeCluster, isMultiCluster, serverConfig } from '../../../config';
import { CLUSTER_DEFAULT } from 'types/Graph';

interface IstioConfigOverviewProps {
  cluster?: string;
  helpMessages?: HelpMessage[];
  istioAPIEnabled: boolean;
  istioObjectDetails: IstioConfigDetails;
  istioValidations?: ObjectValidation;
  kiosk: string;
  namespace: string;
  objectReferences: ObjectReference[];
  selectedLine?: string;
  serviceReferences: ServiceReference[];
  statusMessages: ValidationMessage[];
  workloadReferences: WorkloadReference[];
}

const iconStyle = kialiStyle({
  display: 'inline-block'
});

const infoStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const warnStyle = kialiStyle({
  marginRight: '0.125rem'
});

const healthIconStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const resourceListStyle = kialiStyle({
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const linkStyle = kialiStyle({
  marginLeft: '0.25rem',
  fontSize: '85%',
  color: PFColors.Link
});

export const IstioConfigOverview: React.FC<IstioConfigOverviewProps> = (props: IstioConfigOverviewProps) => {
  const configurationHasWarnings = (): boolean | undefined => {
    return props.istioValidations?.checks.some(check => {
      return check.severity === ValidationTypes.Warning;
    });
  };

  const istioObject = getIstioObject(props.istioObjectDetails);

  const resourceProperties = (
    <div key="properties-list" className={resourceListStyle}>
      <ul style={{ listStyleType: 'none' }}>
        {istioObject && istioObject.metadata.creationTimestamp && (
          <li>
            <span>Created</span>

            <div style={{ display: 'inline-block' }}>
              <LocalTime time={istioObject.metadata.creationTimestamp} />
            </div>
          </li>
        )}

        {istioObject && istioObject.metadata.resourceVersion && (
          <li>
            <span>Version</span>
            {istioObject.metadata.resourceVersion}
          </li>
        )}
      </ul>
    </div>
  );

  let urlInKiali = '';

  if (istioObject !== undefined && istioObject.metadata.namespace !== undefined && istioObject.kind !== undefined) {
    const clusterInfo = serverConfig.clusters[props.cluster ?? homeCluster?.name ?? CLUSTER_DEFAULT];
    const kialiInstance = clusterInfo?.kialiInstances?.find(instance => instance.url.length !== 0);

    // Set the kiali url from kialiInstance info (here a "/console" is required as external link is used)
    const kialiUrl = `${kialiInstance?.url ?? ''}/console`;
    urlInKiali =
      kialiUrl +
      GetIstioObjectUrl(
        istioObject.metadata.name,
        istioObject.metadata.namespace,
        getIstioObjectGVK(istioObject.apiVersion, istioObject.kind),
        props.cluster
      );
  }

  return (
    <Stack hasGutter={true}>
      <StackItem>
        <Title headingLevel="h3" size={TitleSizes.xl}>
          Overview
        </Title>
      </StackItem>

      <StackItem>
        {isMultiCluster && (
          <div key="cluster-icon">
            <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {props.cluster}
          </div>
        )}

        {istioObject && istioObject.kind && (
          <>
            <div className={iconStyle}>
              <PFBadge
                badge={GVKToBadge[gvkToString(getIstioObjectGVK(istioObject.apiVersion, istioObject.kind))]}
                position={TooltipPosition.top}
              />
            </div>

            {istioObject?.metadata.name}

            <Tooltip
              position={TooltipPosition.right}
              content={<div style={{ textAlign: 'left' }}>{resourceProperties}</div>}
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>

            {props.istioValidations &&
              (!props.statusMessages || props.statusMessages.length === 0) &&
              (!props.istioValidations.checks || props.istioValidations.checks.length === 0) && (
                <span className={healthIconStyle}>
                  <ValidationObjectSummary
                    id="config-validation"
                    validations={[props.istioValidations]}
                    reconciledCondition={getReconciliationCondition(props.istioObjectDetails)}
                  />
                </span>
              )}
          </>
        )}
      </StackItem>

      {istioObject?.metadata.labels && (
        <StackItem>
          <Labels tooltipMessage="Labels defined on this resource" labels={istioObject?.metadata.labels}></Labels>
        </StackItem>
      )}

      {((props.statusMessages && props.statusMessages.length > 0) ||
        (props.istioValidations && props.istioValidations.checks && props.istioValidations.checks.length > 0)) && (
        <StackItem>
          <IstioStatusMessageList messages={props.statusMessages} checks={props.istioValidations?.checks} />
        </StackItem>
      )}

      {props.istioValidations?.references && (
        <StackItem>
          <IstioConfigValidationReferences
            objectReferences={props.istioValidations.references}
            cluster={props.cluster}
          />
        </StackItem>
      )}

      {props.istioValidations?.valid && !configurationHasWarnings() && (
        <StackItem>
          <IstioConfigReferences
            objectReferences={props.objectReferences}
            serviceReferences={props.serviceReferences}
            workloadReferences={props.workloadReferences}
            isValid={props.istioValidations?.valid}
            cluster={props.cluster}
          />
        </StackItem>
      )}

      {props.helpMessages && props.helpMessages.length > 0 && (
        <StackItem>
          <IstioConfigHelp helpMessages={props.helpMessages} selectedLine={props.selectedLine}></IstioConfigHelp>
        </StackItem>
      )}

      {!props.istioAPIEnabled && props.cluster === homeCluster?.name && (
        <StackItem>
          <KialiIcon.Warning className={warnStyle} /> <b>Istio API is disabled.</b> Be careful when editing the
          configuration as the Istio config validations are disabled when the Istio API is disabled.
        </StackItem>
      )}

      <KioskElement>
        <StackItem>
          <Tooltip
            content="This is a Read only view of the YAML including Validations. It is possible to edit directly in Kiali "
            position={TooltipPosition.top}
          >
            <Label color="green" isCompact>
              Read only mode
            </Label>
          </Tooltip>

          <a href={urlInKiali} className={linkStyle} target="_blank" rel="noreferrer">
            Edit in Kiali
          </a>
        </StackItem>
      </KioskElement>
    </Stack>
  );
};
