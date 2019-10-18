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
  LockOpenIcon
} from '@patternfly/react-icons';

export const KialiIcon = {
  Info: () => <InfoAltIcon />,
  Ok: () => <OkIcon color={PfColors.Green400} />,
  Warning: () => <WarningTriangleIcon color={PfColors.Orange400} />,
  Error: () => <ErrorCircleOIcon color={PfColors.Red100} />,
  Unknown: () => <UnknownIcon />,
  Topology: () => <TopologyIcon />,
  Service: () => <ServiceIcon />,
  Applications: () => <ApplicationsIcon />,
  Bundle: () => <BundleIcon />,
  CircuitBreaker: () => <BoltIcon />,
  MissingSidecar: () => <CodeBranchIcon />,
  MtlsLock: () => <LockIcon />,
  MtlsUnlock: () => <LockOpenIcon />
};
