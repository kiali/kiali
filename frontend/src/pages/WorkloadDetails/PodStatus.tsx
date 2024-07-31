import * as React from 'react';
import { ObjectCheck, ValidationTypes } from '../../types/IstioObjects';
import { DEGRADED, HEALTHY, isProxyStatusSynced, mergeStatus, ProxyStatus, Status } from '../../types/Health';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ProxyStatusList } from './ProxyStatusList';
import { highestSeverity, validationToHealth } from '../../types/ServiceInfo';
import { ValidationStack } from '../../components/Validations/ValidationStack';
import { createIcon } from 'config/KialiIcon';

type PodStatusProps = {
  checks?: ObjectCheck[];
  proxyStatus?: ProxyStatus;
};

export const PodStatus: React.FC<PodStatusProps> = (props: PodStatusProps) => {
  const proxyStatusSeverity: Status = props.proxyStatus && !isProxyStatusSynced(props.proxyStatus) ? DEGRADED : HEALTHY;

  const showTooltip = (): boolean => {
    const validationSeverity: ValidationTypes = highestSeverity(props.checks || []);
    return proxyStatusSeverity.name !== HEALTHY.name || validationSeverity !== ValidationTypes.Correct;
  };

  if (showTooltip()) {
    const severityIcon = (): Status => {
      const validationSeverity: Status = validationToHealth(highestSeverity(props.checks ?? []));
      return mergeStatus(proxyStatusSeverity, validationSeverity);
    };

    const tooltipContent: React.ReactNode = (
      <>
        <ProxyStatusList status={props.proxyStatus} />
        <ValidationStack checks={props.checks} />
      </>
    );

    return (
      <Tooltip aria-label="Pod Status" position={TooltipPosition.auto} enableFlip={true} content={tooltipContent}>
        <span>{createIcon(severityIcon())}</span>
      </Tooltip>
    );
  } else {
    return createIcon(HEALTHY);
  }
};
