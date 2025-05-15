import * as React from 'react';
import { PFColors } from '../components/Pf/PfColors';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
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
  CheckIcon,
  CloseIcon,
  ClusterIcon,
  CodeBranchIcon,
  CompressIcon,
  CopyIcon,
  EllipsisHIcon,
  EllipsisVIcon,
  EqualizerIcon,
  ErrorCircleOIcon,
  ExclamationCircleIcon,
  ExpandIcon,
  ExpandArrowsAltIcon,
  ExternalLinkAltIcon,
  FileDownloadIcon,
  FilterIcon,
  GithubIcon,
  GlobeAmericasIcon,
  GlobeRouteIcon,
  HelpIcon,
  HistoryIcon,
  HomeIcon,
  InfoAltIcon,
  InProgressIcon,
  LanguageIcon,
  LockIcon,
  LockOpenIcon,
  LongArrowAltRightIcon,
  MapIcon,
  MapMarkerIcon,
  MigrationIcon,
  MinusCircleIcon,
  MoonIcon,
  OkIcon,
  OnRunningIcon,
  OutlinedClockIcon,
  PauseCircleIcon,
  PauseIcon,
  PencilAltIcon,
  PficonDragdropIcon,
  PficonTemplateIcon,
  PlayCircleIcon,
  PlayIcon,
  PlusCircleIcon,
  SaveIcon,
  ServiceIcon,
  ShareAltIcon,
  SortAmountDownAltIcon,
  StarIcon,
  StopIcon,
  SyncAltIcon,
  SunIcon,
  TenantIcon,
  TrashIcon,
  TopologyIcon,
  UnknownIcon,
  UserClockIcon,
  WarningTriangleIcon,
  ProcessAutomationIcon
} from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { Icon } from '@patternfly/react-core';
import { classes } from 'typestyle';

export interface IconProps {
  className?: string;
  status?: string;
  color?: string;
  dataTest?: string;
  icon?: React.ComponentClass<SVGIconProps>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// keep alphabetized
export const KialiIcon: { [name: string]: React.FunctionComponent<IconProps> } = {
  AddMore: (props: IconProps) => createIcon(props, PlusCircleIcon),
  AngleDoubleDown: (props: IconProps) => createIcon(props, AngleDoubleDownIcon),
  AngleDoubleLeft: (props: IconProps) => createIcon(props, AngleDoubleLeftIcon),
  AngleDoubleRight: (props: IconProps) => createIcon(props, AngleDoubleRightIcon),
  AngleDoubleUp: (props: IconProps) => createIcon(props, AngleDoubleUpIcon),
  AngleDown: (props: IconProps) => createIcon(props, AngleDownIcon),
  AngleLeft: (props: IconProps) => createIcon(props, AngleLeftIcon),
  AngleRight: (props: IconProps) => createIcon(props, AngleRightIcon),
  Applications: (props: IconProps) => createIcon(props, ApplicationsIcon),
  Back: (props: IconProps) => createIcon(props, ArrowLeftIcon),
  Bell: (props: IconProps) => createIcon(props, BellIcon),
  Check: (props: IconProps) => createIcon(props, CheckIcon),
  CircuitBreaker: (props: IconProps) => createIcon(props, BoltIcon),
  Clock: (props: IconProps) => createIcon(props, OutlinedClockIcon),
  Close: (props: IconProps) => createIcon(props, CloseIcon),
  Cluster: (props: IconProps) => createIcon(props, ClusterIcon),
  Compress: (props: IconProps) => createIcon(props, CompressIcon),
  Copy: (props: IconProps) => createIcon(props, CopyIcon),
  Delete: (props: IconProps) => createIcon(props, MinusCircleIcon),
  DragDrop: (props: IconProps) => createIcon(props, PficonDragdropIcon),
  Download: (props: IconProps) => createIcon(props, FileDownloadIcon),
  Equalizer: (props: IconProps) => createIcon(props, EqualizerIcon),
  Error: (props: IconProps) => createIcon(props, ErrorCircleOIcon, PFColors.Danger),
  ExclamationCircle: (props: IconProps) => createIcon(props, ExclamationCircleIcon, PFColors.Danger),
  Expand: (props: IconProps) => createIcon(props, ExpandIcon),
  ExpandArrows: (props: IconProps) => createIcon(props, ExpandArrowsAltIcon),
  ExternalLink: (props: IconProps) => createIcon(props, ExternalLinkAltIcon),
  FaultInjection: (props: IconProps) => createIcon(props, BanIcon),
  Filter: (props: IconProps) => createIcon(props, FilterIcon),
  Gateway: (props: IconProps) => createIcon(props, GlobeRouteIcon),
  Github: (props: IconProps) => createIcon(props, GithubIcon),
  Help: (props: IconProps) => createIcon(props, HelpIcon),
  History: (props: IconProps) => createIcon(props, HistoryIcon),
  Info: (props: IconProps) => createIcon(props, InfoAltIcon, PFColors.Info),
  IstioConfig: (props: IconProps) => createIcon(props, PficonTemplateIcon),
  InProgressIcon: (props: IconProps) => createIcon(props, InProgressIcon),
  KebabToggle: (props: IconProps) => createIcon(props, EllipsisVIcon),
  Language: (props: IconProps) => createIcon(props, LanguageIcon),
  LocalTime: (props: IconProps) => createIcon(props, GlobeAmericasIcon),
  LongArrowRight: (props: IconProps) => createIcon(props, LongArrowAltRightIcon),
  Map: (props: IconProps) => createIcon(props, MapIcon),
  MapMarker: (props: IconProps) => createIcon(props, MapMarkerIcon),
  Mirroring: (props: IconProps) => createIcon(props, MigrationIcon),
  Moon: (props: IconProps) => createIcon(props, MoonIcon),
  MoreLegend: (props: IconProps) => createIcon(props, EllipsisHIcon),
  MtlsLock: (props: IconProps) => createIcon(props, LockIcon),
  MtlsUnlock: (props: IconProps) => createIcon(props, LockOpenIcon),
  Ok: (props: IconProps) => createIcon(props, OkIcon, PFColors.Success),
  OnRunningIcon: (props: IconProps) => createIcon(props, OnRunningIcon),
  OutOfMesh: (props: IconProps) => createIcon(props, BlueprintIcon),
  Pause: (props: IconProps) => createIcon(props, PauseIcon),
  PauseCircle: (props: IconProps) => createIcon(props, PauseCircleIcon),
  PencilAlt: (props: IconProps) => createIcon(props, PencilAltIcon),
  Play: (props: IconProps) => createIcon(props, PlayIcon),
  PlayCircle: (props: IconProps) => createIcon(props, PlayCircleIcon),
  Rank: (props: IconProps) => createIcon(props, SortAmountDownAltIcon),
  Regex: (props: IconProps) => createIcon(props, AsteriskIcon),
  RequestRouting: (props: IconProps) => createIcon(props, CodeBranchIcon),
  ResetSettings: (props: IconProps) => createIcon(props, ProcessAutomationIcon),
  RequestTimeout: (props: IconProps) => createIcon(props, OutlinedClockIcon),
  Save: (props: IconProps) => createIcon(props, SaveIcon),
  Services: (props: IconProps) => createIcon(props, ServiceIcon),
  Star: (props: IconProps) => createIcon(props, StarIcon),
  Stop: (props: IconProps) => createIcon(props, StopIcon),
  Sun: (props: IconProps) => createIcon(props, SunIcon),
  Sync: (props: IconProps) => createIcon(props, SyncAltIcon),
  Tenant: (props: IconProps) => createIcon(props, TenantIcon),
  Topology: (props: IconProps) => createIcon(props, TopologyIcon),
  Trash: (props: IconProps) => createIcon(props, TrashIcon),
  TrafficShifting: (props: IconProps) => createIcon(props, ShareAltIcon),
  Unknown: (props: IconProps) => createIcon(props, UnknownIcon),
  UserClock: (props: IconProps) => createIcon(props, UserClockIcon),
  VirtualService: (props: IconProps) => createIcon(props, CodeBranchIcon),
  Warning: (props: IconProps) => createIcon(props, WarningTriangleIcon, PFColors.Warning),
  Website: (props: IconProps) => createIcon(props, HomeIcon),
  Workloads: (props: IconProps) => createIcon(props, BundleIcon)
};

export const createIcon = (
  props: IconProps,
  icon?: React.ComponentClass<SVGIconProps>,
  colorIcon?: string
): React.ReactElement => {
  const iconComponent = props.icon ?? icon ?? React.Fragment;

  const iconColor = props.color ?? colorIcon;

  const iconStyle = iconColor ? kialiStyle({ color: iconColor }) : undefined;
  return (
    <Icon className={classes(props.className, iconStyle)} size={props.size} data-test={props.dataTest} status={props.status as any}>
      {React.createElement(iconComponent)}
    </Icon>
  );
};


// createTooltipIcon wraps the icon in a span element. Tooltip child elements that are
// SVGs (icons) need to be wrapped in something to avoid the tooltip from disappearing on refresh.
// See: https://github.com/kiali/kiali/issues/3583 for more details.
export function createTooltipIcon(icon: React.ReactNode): React.ReactElement {
  return <span>{icon}</span>;
}
