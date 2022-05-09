import deepFreeze from 'deep-freeze';

import solidPinIcon from '../assets/img/solid-pin.png';
import hollowPinIcon from '../assets/img/hollow-pin.png';
import { BlueprintIcon, WrenchIcon, SecurityIcon } from '@patternfly/react-icons';

export { solidPinIcon, hollowPinIcon };

// The unicode values in the ascii fields come from:
// https://www.patternfly.org/v3/styles/icons/index.html
// or from the font awesome site: https://fontawesome.com/icons
const mutIcons = {
  istio: {
    circuitBreaker: { className: 'fa fa-bolt', type: 'fa', name: 'bolt', ascii: '\uf0e7 ' },
    missingLabel: {
      icon: WrenchIcon,
      className: 'fa fa-wrench',
      type: 'fa',
      name: 'wrench',
      ascii: '\uE932',
      color: 'red'
    },
    faultInjection: { className: 'fa fa-ban', type: 'fa', name: 'ban', ascii: '\uf05e ' },
    gateway: { className: 'pf-icon pf-icon-globe-route', type: 'pf', name: 'globe-route' },
    mirroring: { className: 'pf-icon pf-icon-migration', type: 'pf', name: 'migration' },
    missingAuthPolicy: {
      icon: SecurityIcon,
      className: 'pf-icon pf-icon-security',
      type: 'pf',
      name: 'security',
      ascii: '\ue946 ',
      color: 'red'
    },
    missingSidecar: {
      icon: BlueprintIcon,
      className: 'pf-icon pf-icon-blueprint',
      type: 'pf',
      name: 'blueprint',
      ascii: '\ue915 ',
      color: 'red'
    },
    mtls: { className: 'pf-icon pf-icon-locked', type: 'pf', name: 'locked', ascii: '\uE923 ' },
    requestRouting: { className: 'fa fa-code-branch', type: 'fa', name: 'code-fork', ascii: '\uf126 ' },
    requestTimeout: { className: 'fa fa-clock', type: 'fa', name: 'clock', ascii: '\uf017 ' },
    root: { className: 'fa fa-arrow-alt-circle-right', type: 'fa', name: 'arrow-alt-circle-right', ascii: '\uf35a ' },
    trafficShifting: { className: 'fa fa-share-alt', type: 'fa', name: 'share-alt', ascii: '\uf1e0 ' },
    virtualService: { className: 'fa fa-code-branch', type: 'fa', name: 'code-fork', ascii: '\uf126 ' },
    workloadEntry: {
      className: 'pf-icon pf-icon-virtual-machine',
      type: 'pf',
      name: 'virtual-machine',
      ascii: '\uf126 '
    }
  }
};

export const icons = deepFreeze(mutIcons) as typeof mutIcons;
