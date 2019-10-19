import * as React from 'react';
import { PfColors } from '../components/Pf/PfColors';
import {
  ApplicationsIcon,
  BundleIcon,
  ErrorCircleOIcon,
  InfoAltIcon,
  OkIcon,
  ServiceIcon,
  TopologyIcon,
  UnknownIcon,
  WarningTriangleIcon,
  CodeBranchIcon,
  BoltIcon,
  LockIcon,
  LockOpenIcon,
  BlueprintIcon,
  AngleDoubleUpIcon,
  AngleDoubleDownIcon
} from '@patternfly/react-icons';
import { style } from 'typestyle';

const iconStyle = style({
  width: '10px'
});

export const KialiIcon = {
  Info: () => <InfoAltIcon className={iconStyle} />,
  Ok: () => <OkIcon className={iconStyle} color={PfColors.Green400} />,
  Warning: () => <WarningTriangleIcon className={iconStyle} color={PfColors.Orange400} />,
  Error: () => <ErrorCircleOIcon className={iconStyle} color={PfColors.Red100} />,
  Unknown: () => <UnknownIcon className={iconStyle} />,
  Topology: () => <TopologyIcon className={iconStyle} />,
  Services: () => <ServiceIcon className={iconStyle} />,
  Applications: () => <ApplicationsIcon className={iconStyle} />,
  Workloads: () => <BundleIcon className={iconStyle} />,
  VirtualService: () => <BlueprintIcon className={iconStyle} />,
  CircuitBreaker: () => <BoltIcon className={iconStyle} />,
  MissingSidecar: () => <CodeBranchIcon className={iconStyle} />,
  MtlsLock: () => <LockIcon className={iconStyle} />,
  MtlsUnlock: () => <LockOpenIcon className={iconStyle} />,
  AngleDoubleUp: () => <AngleDoubleUpIcon className={iconStyle} />,
  AngleDoubleDown: () => <AngleDoubleDownIcon className={iconStyle} />
};
