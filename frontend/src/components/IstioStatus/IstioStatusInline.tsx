import * as React from 'react';
import { IstioStatus } from './IstioStatus';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon
} from '@patternfly/react-icons';

type Props = {
  cluster?: string;
};

export function IstioStatusInline({ cluster }: Props) {
  return (
    <IstioStatus
      icons={{
        ErrorIcon: ExclamationCircleIcon,
        HealthyIcon: CheckCircleIcon,
        InfoIcon: MinusCircleIcon,
        WarningIcon: ExclamationTriangleIcon
      }}
      cluster={cluster}
    />
  );
}
