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
  AngleDoubleDownIcon,
  BellIcon,
  AngleDoubleLeftIcon,
  AngleDoubleRightIcon
} from '@patternfly/react-icons';
import { style } from 'typestyle';

const iconStyle = style({
  width: '10px'
});

interface IconProps {
  className?: string;
}

// keep alphabetized
export const KialiIcon: { [name: string]: React.FunctionComponent<IconProps> } = {
  AngleDoubleDown: (props: IconProps) => <AngleDoubleDownIcon className={props.className} />,
  AngleDoubleLeft: (props: IconProps) => <AngleDoubleLeftIcon className={props.className} />,
  AngleDoubleRight: (props: IconProps) => <AngleDoubleRightIcon className={props.className} />,
  AngleDoubleUp: (props: IconProps) => <AngleDoubleUpIcon className={props.className} />,
  Applications: (props: IconProps) => <ApplicationsIcon className={props.className} />,
  Bell: (props: IconProps) => <BellIcon className={props.className} />,
  CircuitBreaker: (props: IconProps) => <BoltIcon className={props.className} />,
  Error: (props: IconProps) => <ErrorCircleOIcon className={props.className} color={PfColors.Danger} />,
  Info: (props: IconProps) => <InfoAltIcon className={props.className} color={PfColors.Info} />,
  Ok: (props: IconProps) => <OkIcon className={props.className} color={PfColors.Success} />,
  MissingSidecar: (props: IconProps) => <CodeBranchIcon className={props.className} />,
  MtlsLock: (props: IconProps) => <LockIcon className={props.className} />,
  MtlsUnlock: (props: IconProps) => <LockOpenIcon className={props.className} />,
  Services: (props: IconProps) => <ServiceIcon className={props.className} />,
  Topology: (props: IconProps) => <TopologyIcon className={props.className} />,
  Unknown: (props: IconProps) => <UnknownIcon className={props.className} />,
  VirtualService: (props: IconProps) => <BlueprintIcon className={props.className} />,
  Warning: (props: IconProps) => <WarningTriangleIcon className={props.className} color={PfColors.Warning} />,
  Workloads: (props: IconProps) => <BundleIcon className={props.className} />
};

Object.keys(KialiIcon).forEach(key => {
  KialiIcon[key].defaultProps = {
    className: iconStyle
  };
});
