import * as React from 'react';
import deepFreeze from 'deep-freeze';
import {
  ArrowAltCircleRightIcon,
  BanIcon,
  BlueprintIcon,
  BoltIcon,
  ClockIcon,
  CodeBranchIcon,
  GlobeRouteIcon,
  InfrastructureIcon,
  LockedIcon,
  MigrationIcon,
  SecurityIcon,
  ShareAltIcon,
  VirtualMachineIcon,
  WrenchIcon
} from '@patternfly/react-icons';

export type IconType = {
  ascii?: string;
  className: string;
  color?: string;
  icon: React.ComponentClass<any, any>;
  name: string;
  text: string;
  type: string;
};

// The unicode values in the ascii fields come from:
// https://www.patternfly.org/v3/styles/icons/index.html
// or from the font awesome site: https://fontawesome.com/icons
const mutIcons = {
  istio: {
    circuitBreaker: {
      ascii: '\uf0e7 ',
      className: 'fa fa-bolt',
      icon: BoltIcon,
      name: 'bolt',
      text: 'Circuit Breaker',
      type: 'fa'
    } as IconType,
    faultInjection: {
      ascii: '\uf05e ',
      className: 'fa fa-ban',
      icon: BanIcon,
      name: 'ban',
      text: 'Fault Injection',
      type: 'fa'
    } as IconType,
    gateway: {
      className: 'pf-v6-pficon pf-v6-pficon-globe-route',
      icon: GlobeRouteIcon,
      name: 'globe-route',
      text: 'Gateway',
      type: 'pf'
    } as IconType,
    mirroring: {
      className: 'pf-v6-pficon pf-v6-pficon-migration',
      icon: MigrationIcon,
      name: 'migration',
      text: 'Mirroring',
      type: 'pf'
    } as IconType,
    missingAuthPolicy: {
      ascii: '\ue946 ',
      className: 'pf-v6-pficon pf-v6-pficon-security',
      color: 'red',
      icon: SecurityIcon,
      name: 'security',
      text: 'Missing Auth Policy',
      type: 'pf'
    } as IconType,
    missingLabel: {
      ascii: '\uE932',
      className: 'fa fa-wrench',
      color: 'red',
      icon: WrenchIcon,
      name: 'wrench',
      text: 'Missing Label',
      type: 'fa'
    } as IconType,
    missingSidecar: {
      ascii: '\ue915 ',
      className: 'pf-v6-pficon pf-v6-pficon-blueprint',
      color: 'red',
      icon: BlueprintIcon,
      name: 'blueprint',
      text: 'Missing Sidecar',
      type: 'pf'
    } as IconType,
    mtls: {
      ascii: '\ue923 ',
      className: 'pf-v6-pficon pf-v6-pficon-locked',
      icon: LockedIcon,
      name: 'locked',
      text: 'mTLS',
      type: 'pf'
    } as IconType,
    requestRouting: {
      ascii: '\uf126 ',
      className: 'fa fa-code-branch',
      icon: CodeBranchIcon,
      name: 'code-fork',
      text: 'Request Routing',
      type: 'fa'
    } as IconType,
    requestTimeout: {
      ascii: '\uf017 ',
      className: 'fa fa-clock',
      icon: ClockIcon,
      name: 'clock',
      text: 'request Timeout',
      type: 'fa'
    },
    root: {
      ascii: '\uf35a ',
      className: 'fa fa-arrow-alt-circle-right',
      icon: ArrowAltCircleRightIcon,
      name: 'arrow-alt-circle-right',
      text: 'Traffic Source',
      type: 'fa'
    } as IconType,
    trafficShifting: {
      ascii: '\uf1e0 ',
      className: 'fa fa-share-alt',
      icon: ShareAltIcon,
      name: 'share-alt',
      text: 'Traffic Shifting',
      type: 'fa'
    } as IconType,
    virtualService: {
      ascii: '\uf126 ',
      className: 'fa fa-code-branch',
      icon: CodeBranchIcon,
      name: 'code-fork',
      text: 'Virtual Service',
      type: 'fa'
    } as IconType,
    workloadEntry: {
      ascii: '\uf126 ',
      className: 'pf-v6-pficon pf-v6-pficon-virtual-machine',
      icon: VirtualMachineIcon,
      name: 'virtual-machine',
      text: 'Workload Entry',
      type: 'pf'
    } as IconType,
    waypoint: {
      ascii: 'E93D ',
      className: 'pf-v6-pficon pf-v6-pficon-infrastructure',
      icon: InfrastructureIcon,
      name: 'infrastructure',
      text: 'Waypoint Proxy',
      type: 'pf'
    }
  },
  unicode: {
    // these are not fully defined icons, just unicode characters.
    // see https://en.wikipedia.org/wiki/List_of_Unicode_characters#Arrows
    arrowRightOverLeft: {
      char: '\u21c4 ',
      name: 'RightwardsArrowOverLeftwardsArrow',
      text: 'Rightwards Arrow Over Leftwards Arrow'
    },
    arrowUpLeftofDown: {
      char: '\u21c5 ',
      name: 'UpwardsArrowLeftwardsofDownwardsArrow',
      text: 'Upwards Arrow Leftwards of Downwards Arrow'
    },
    arrowDownLeftofUp: {
      char: '\u21f5 ',
      name: 'DownwardsArrowLeftwardsofUpwardsArrow ',
      text: 'Downwards Arrow Leftwards of Upwards Arrow '
    }
  }
};

export const icons = deepFreeze(mutIcons) as typeof mutIcons;
