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
  CopyIcon,
  AngleRightIcon,
  AngleLeftIcon,
  HelpIcon,
  HistoryIcon,
  BellIcon,
  AngleDoubleLeftIcon,
  AngleDoubleRightIcon,
  RepositoryIcon,
  AngleDownIcon,
  HomeIcon,
  PficonTemplateIcon,
  ArrowLeftIcon,
  OutlinedClockIcon,
  PauseIcon,
  PauseCircleIcon,
  PlayIcon,
  PlayCircleIcon,
  StopIcon,
  UserClockIcon,
  OnRunningIcon,
  InProgressIcon
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
  Back: (props: IconProps) => <ArrowLeftIcon className={props.className} />,
  Bell: (props: IconProps) => <BellIcon className={props.className} />,
  CircuitBreaker: (props: IconProps) => <BoltIcon className={props.className} />,
  Clock: (props: IconProps) => <OutlinedClockIcon className={props.className} />,
  Close: (props: IconProps) => <CloseIcon className={props.className} />,
  Copy: (props: IconProps) => <CopyIcon className={props.className} />,
  Error: (props: IconProps) => <ErrorCircleOIcon className={props.className} color={PFAlertColor.Danger} />,
  Help: (props: IconProps) => <HelpIcon className={props.className} />,
  History: (props: IconProps) => <HistoryIcon className={props.className} />,
  Info: (props: IconProps) => <InfoAltIcon className={props.className} color={PFAlertColor.Info} />,
  IstioConfig: (props: IconProps) => <PficonTemplateIcon className={props.className} />,
  LocalTime: (props: IconProps) => <GlobeAmericasIcon className={props.className} />,
  MissingSidecar: (props: IconProps) => <BlueprintIcon className={props.className} />,
  MtlsLock: (props: IconProps) => <LockIcon className={props.className} />,
  MtlsUnlock: (props: IconProps) => <LockOpenIcon className={props.className} />,
  Ok: (props: IconProps) => <OkIcon className={props.className} color={PFAlertColor.Success} />,
  Pause: (props: IconProps) => <PauseIcon className={props.className} />,
  PauseCircle: (props: IconProps) => <PauseCircleIcon className={props.className} />,
  Play: (props: IconProps) => <PlayIcon className={props.className} />,
  PlayCircle: (props: IconProps) => <PlayCircleIcon className={props.className} />,
  Repository: (props: IconProps) => <RepositoryIcon className={props.className} />,
  Services: (props: IconProps) => <ServiceIcon className={props.className} />,
  Stop: (props: IconProps) => <StopIcon className={props.className} />,
  Topology: (props: IconProps) => <TopologyIcon className={props.className} />,
  Unknown: (props: IconProps) => <UnknownIcon className={props.className} />,
  UserClock: (props: IconProps) => <UserClockIcon className={props.className} />,
  VirtualService: (props: IconProps) => <CodeBranchIcon className={props.className} />,
  Warning: (props: IconProps) => <WarningTriangleIcon className={props.className} color={PFAlertColor.Warning} />,
  Website: (props: IconProps) => <HomeIcon className={props.className} />,
  Workloads: (props: IconProps) => <BundleIcon className={props.className} />,
  OnRunningIcon: (props: IconProps) => <OnRunningIcon className={props.className} />,
  InProgressIcon: (props: IconProps) => <InProgressIcon className={props.className} />
};

Object.keys(KialiIcon).forEach(key => {
  KialiIcon[key].defaultProps = {
    className: iconStyle
  };
});
