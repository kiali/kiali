import React from 'react';
import deepFreeze from 'deep-freeze';
import {
  ArrowAltCircleRightIcon,
  BanIcon,
  BlueprintIcon,
  BoltIcon,
  ClockIcon,
  CodeBranchIcon,
  GlobeRouteIcon,
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
      className: 'pf-v5-pficon pf-v5-pficon-globe-route',
      icon: GlobeRouteIcon,
      name: 'globe-route',
      text: 'Gateway',
      type: 'pf'
    } as IconType,
    mirroring: {
      className: 'pf-v5-pficon pf-v5-pficon-migration',
      icon: MigrationIcon,
      name: 'migration',
      text: 'Mirroring',
      type: 'pf'
    } as IconType,
    missingAuthPolicy: {
      ascii: '\ue946 ',
      className: 'pf-v5-pficon pf-v5-pficon-security',
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
      className: 'pf-v5-pficon pf-v5-pficon-blueprint',
      color: 'red',
      icon: BlueprintIcon,
      name: 'blueprint',
      text: 'Missing Sidecar',
      type: 'pf'
    } as IconType,
    mtls: {
      ascii: '\ue923 ',
      className: 'pf-v5-pficon pf-v5-pficon-locked',
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
      className: 'pf-v5-pficon pf-v5-pficon-virtual-machine',
      icon: VirtualMachineIcon,
      name: 'virtual-machine',
      text: 'Workload Entry',
      type: 'pf'
    } as IconType
  }
};

export const icons = deepFreeze(mutIcons) as typeof mutIcons;
