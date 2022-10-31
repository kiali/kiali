import * as React from 'react';
import IstioStatus from "./IstioStatus";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon
} from "@patternfly/react-icons";

export default function IstioStatusInline() {
  return <IstioStatus icons={{
    ErrorIcon: ExclamationCircleIcon,
    HealthyIcon: CheckCircleIcon,
    InfoIcon: MinusCircleIcon,
    WarningIcon: ExclamationTriangleIcon
  }} />;
}
