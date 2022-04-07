import * as React from 'react';
import { PFColors } from '../components/Pf/PfColors';
import {
  AngleDoubleDownIcon,
  AngleDoubleLeftIcon,
  AngleDoubleRightIcon,
  AngleDoubleUpIcon,
  AngleDownIcon,
  AngleLeftIcon,
  AngleRightIcon,
  ApplicationsIcon,
  ArrowLeftIcon,
  AsteriskIcon,
  BanIcon,
  BellIcon,
  BlueprintIcon,
  BoltIcon,
  BundleIcon,
  CloseIcon,
  CodeBranchIcon,
  CompressIcon,
  CopyIcon,
  EllipsisHIcon,
  ErrorCircleOIcon,
  ExpandIcon,
  FileDownloadIcon,
  FilterIcon,
  GlobeAmericasIcon,
  GlobeRouteIcon,
  HelpIcon,
  HistoryIcon,
  HomeIcon,
  InfoAltIcon,
  InProgressIcon,
  LockIcon,
  LockOpenIcon,
  MigrationIcon,
  OkIcon,
  OnRunningIcon,
  OutlinedClockIcon,
  PauseCircleIcon,
  PauseIcon,
  PficonTemplateIcon,
  PlayCircleIcon,
  PlayIcon,
  RepositoryIcon,
  ServiceIcon,
  ShareAltIcon,
  SortAmountDownAltIcon,
  StopIcon,
  TopologyIcon,
  UnknownIcon,
  UserClockIcon,
  WarningTriangleIcon,
  ProcessAutomationIcon
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
  color?: string;
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
  Compress: (props: IconProps) => <CompressIcon className={props.className} />,
  Copy: (props: IconProps) => <CopyIcon className={props.className} />,
  Download: (props: IconProps) => <FileDownloadIcon className={props.className} />,
  Error: (props: IconProps) => <ErrorCircleOIcon className={props.className} color={props.color || PFColors.Danger} />,
  Expand: (props: IconProps) => <ExpandIcon className={props.className} />,
  FaultInjection: (props: IconProps) => <BanIcon className={props.className} />,
  Filter: (props: IconProps) => <FilterIcon className={props.className} />,
  Gateway: (props: IconProps) => <GlobeRouteIcon className={props.className} />,
  Help: (props: IconProps) => <HelpIcon className={props.className} />,
  History: (props: IconProps) => <HistoryIcon className={props.className} />,
  Info: (props: IconProps) => <InfoAltIcon className={props.className} color={props.color || PFColors.Info} />,
  IstioConfig: (props: IconProps) => <PficonTemplateIcon className={props.className} />,
  InProgressIcon: (props: IconProps) => <InProgressIcon className={props.className} />,
  LocalTime: (props: IconProps) => <GlobeAmericasIcon className={props.className} />,
  Mirroring: (props: IconProps) => <MigrationIcon className={props.className} />,
  MissingSidecar: (props: IconProps) => <BlueprintIcon className={props.className} />,
  MoreLegend: (props: IconProps) => <EllipsisHIcon className={props.className} />,
  MtlsLock: (props: IconProps) => <LockIcon className={props.className} />,
  MtlsUnlock: (props: IconProps) => <LockOpenIcon className={props.className} />,
  Ok: (props: IconProps) => <OkIcon className={props.className} color={props.color || PFColors.Success} />,
  OnRunningIcon: (props: IconProps) => <OnRunningIcon className={props.className} />,
  Pause: (props: IconProps) => <PauseIcon className={props.className} />,
  PauseCircle: (props: IconProps) => <PauseCircleIcon className={props.className} />,
  Play: (props: IconProps) => <PlayIcon className={props.className} />,
  PlayCircle: (props: IconProps) => <PlayCircleIcon className={props.className} />,
  Rank: (props: IconProps) => <SortAmountDownAltIcon className={props.className} />,
  Regex: (props: IconProps) => <AsteriskIcon className={props.className} />,
  Repository: (props: IconProps) => <RepositoryIcon className={props.className} />,
  RequestRouting: (props: IconProps) => <CodeBranchIcon className={props.className} />,
  ResetSettings: (props: IconProps) => <ProcessAutomationIcon className={props.className} />,
  RequestTimeout: (props: IconProps) => <OutlinedClockIcon className={props.className} />,
  Services: (props: IconProps) => <ServiceIcon className={props.className} />,
  Stop: (props: IconProps) => <StopIcon className={props.className} />,
  Topology: (props: IconProps) => <TopologyIcon className={props.className} />,
  TrafficShifting: (props: IconProps) => <ShareAltIcon className={props.className} />,
  Unknown: (props: IconProps) => <UnknownIcon className={props.className} />,
  UserClock: (props: IconProps) => <UserClockIcon className={props.className} />,
  VirtualService: (props: IconProps) => <CodeBranchIcon className={props.className} />,
  Warning: (props: IconProps) => (
    <WarningTriangleIcon className={props.className} color={props.color || PFColors.Warning} />
  ),
  Website: (props: IconProps) => <HomeIcon className={props.className} />,
  Workloads: (props: IconProps) => <BundleIcon className={props.className} />
};

Object.keys(KialiIcon).forEach(key => {
  KialiIcon[key].defaultProps = {
    className: iconStyle
  };
});

// createTooltipIcon wraps the icon in a span element. Tooltip child elements that are
// SVGs (icons) need to be wrapped in something to avoid the tooltip from disappearing on refresh.
// See: https://github.com/kiali/kiali/issues/3583 for more details.
export function createTooltipIcon(icon: any) {
  return <span>{icon}</span>;
}
