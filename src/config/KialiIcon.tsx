import * as React from 'react';
import { PFAlertColor } from '../components/Pf/PfColors';
import {
  ApplicationsIcon,
  BundleIcon,
  ErrorCircleOIcon,
  GlobeAmericasIcon,
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
  CloseIcon,
  AngleRightIcon,
  AngleLeftIcon,
  HelpIcon,
  BellIcon,
  AngleDoubleLeftIcon,
  AngleDoubleRightIcon,
  RepositoryIcon,
  AngleDownIcon,
  HomeIcon,
  PficonTemplateIcon
} from '@patternfly/react-icons';
import { style } from 'typestyle';

export const defaultIconStyle = style({
  // nothing special
});

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
  AngleDown: (props: IconProps) => <AngleDownIcon className={props.className} />,
  AngleLeft: (props: IconProps) => <AngleLeftIcon className={props.className} />,
  AngleRight: (props: IconProps) => <AngleRightIcon className={props.className} />,
  Applications: (props: IconProps) => <ApplicationsIcon className={props.className} />,
  Bell: (props: IconProps) => <BellIcon className={props.className} />,
  CircuitBreaker: (props: IconProps) => <BoltIcon className={props.className} />,
  Close: (props: IconProps) => <CloseIcon className={props.className} />,
  Error: (props: IconProps) => <ErrorCircleOIcon className={props.className} color={PFAlertColor.Danger} />,
  Help: (props: IconProps) => <HelpIcon className={props.className} />,
  Info: (props: IconProps) => <InfoAltIcon className={props.className} color={PFAlertColor.Info} />,
  IstioConfig: (props: IconProps) => <PficonTemplateIcon className={props.className} />,
  LocalTime: (props: IconProps) => <GlobeAmericasIcon className={props.className} />,
  MissingSidecar: (props: IconProps) => <BlueprintIcon className={props.className} />,
  MtlsLock: (props: IconProps) => <LockIcon className={props.className} />,
  MtlsUnlock: (props: IconProps) => <LockOpenIcon className={props.className} />,
  Ok: (props: IconProps) => <OkIcon className={props.className} color={PFAlertColor.Success} />,
  Repository: (props: IconProps) => <RepositoryIcon className={props.className} />,
  Services: (props: IconProps) => <ServiceIcon className={props.className} />,
  Topology: (props: IconProps) => <TopologyIcon className={props.className} />,
  Unknown: (props: IconProps) => <UnknownIcon className={props.className} />,
  VirtualService: (props: IconProps) => <CodeBranchIcon className={props.className} />,
  Warning: (props: IconProps) => <WarningTriangleIcon className={props.className} color={PFAlertColor.Warning} />,
  Website: (props: IconProps) => <HomeIcon className={props.className} />,
  Workloads: (props: IconProps) => <BundleIcon className={props.className} />
};

Object.keys(KialiIcon).forEach(key => {
  KialiIcon[key].defaultProps = {
    className: iconStyle
  };
});
