import { Stack, StackItem, TooltipPosition } from '@patternfly/react-core';
import { Labels } from 'components/Label/Labels';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { LocalTime } from 'components/Time/LocalTime';
import * as React from 'react';
import type { IstioConfigDetails } from 'types/IstioConfigDetails';
import { ValidationTypes } from 'types/IstioObjects';
import type {
  HelpMessage,
  ObjectReference,
  ObjectValidation,
  ServiceReference,
  ValidationMessage,
  WorkloadReference
} from 'types/IstioObjects';
import { kialiStyle } from 'styles/StyleUtils';
import { getIstioObject } from 'utils/IstioConfigUtils';
import { IstioConfigHelp } from './IstioConfigHelp';
import { IstioConfigReferences } from './IstioConfigReferences';
import { IstioConfigValidationReferences } from './IstioConfigValidationReferences';
import { IstioStatusMessageList } from './IstioStatusMessageList';
import { isMultiCluster } from '../../../config';

interface IstioConfigOverviewProps {
  helpMessages?: HelpMessage[];
  istioObjectDetails: IstioConfigDetails;
  istioValidations?: ObjectValidation;
  namespace: string;
  objectReferences: ObjectReference[];
  selectedLine?: string;
  serviceReferences: ServiceReference[];
  statusMessages: ValidationMessage[];
  workloadReferences: WorkloadReference[];
}

const metadataStyle = kialiStyle({
  color: 'var(--pf-t--global--color--subtle)',
  fontSize: 'var(--pf-t--global--font--size--sm)'
});

export const IstioConfigOverview: React.FC<IstioConfigOverviewProps> = (props: IstioConfigOverviewProps) => {
  const cluster = props.istioObjectDetails.cluster || props.istioObjectDetails.namespace.cluster;

  const configurationHasWarnings = (): boolean | undefined => {
    return props.istioValidations?.checks.some(check => {
      return check.severity === ValidationTypes.Warning;
    });
  };

  const hasReferences = (): boolean => {
    return (
      props.objectReferences.length > 0 || props.serviceReferences.length > 0 || props.workloadReferences.length > 0
    );
  };

  const istioObject = getIstioObject(props.istioObjectDetails);

  return (
    <Stack hasGutter={true}>
      {isMultiCluster && (
        <StackItem>
          <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {cluster}
        </StackItem>
      )}

      {istioObject?.metadata.creationTimestamp && (
        <StackItem className={metadataStyle}>
          Created <LocalTime time={istioObject.metadata.creationTimestamp} />
        </StackItem>
      )}

      {istioObject?.metadata.labels && (
        <StackItem>
          <Labels tooltipMessage="Labels defined on this resource" labels={istioObject?.metadata.labels}></Labels>
        </StackItem>
      )}

      {props.istioValidations?.references && (
        <StackItem>
          <IstioConfigValidationReferences objectReferences={props.istioValidations.references} cluster={cluster} />
        </StackItem>
      )}

      {((!props.istioValidations && hasReferences()) ||
        (props.istioValidations?.valid && !configurationHasWarnings())) && (
        <StackItem>
          <IstioConfigReferences
            objectReferences={props.objectReferences}
            serviceReferences={props.serviceReferences}
            workloadReferences={props.workloadReferences}
            isValid={!props.istioValidations || props.istioValidations?.valid}
            cluster={cluster}
          />
        </StackItem>
      )}

      {((props.statusMessages && props.statusMessages.length > 0) ||
        (props.istioValidations && props.istioValidations.checks && props.istioValidations.checks.length > 0)) && (
        <StackItem>
          <IstioStatusMessageList messages={props.statusMessages} checks={props.istioValidations?.checks} />
        </StackItem>
      )}

      {props.helpMessages && props.helpMessages.length > 0 && (
        <StackItem>
          <IstioConfigHelp helpMessages={props.helpMessages} selectedLine={props.selectedLine}></IstioConfigHelp>
        </StackItem>
      )}
    </Stack>
  );
};
