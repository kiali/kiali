import * as React from 'react';

import { MTLSIconTypes } from './MTLSIcon';
import { MTLSStatus, emptyDescriptor, StatusDescriptor } from './MTLSStatus';
import { kialiStyle } from 'styles/StyleUtils';
import { MTLSStatuses } from '../../types/TLSStatus';

type Props = {
  status: string;
};

const statusDescriptors = new Map<string, StatusDescriptor>([
  [
    MTLSStatuses.ENABLED,
    {
      message: 'mTLS is enabled for this namespace',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.ENABLED_EXTENDED,
    {
      message: 'mTLS is enabled for this namespace, extended from Mesh-wide config',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.PARTIALLY,
    {
      message: 'mTLS is partially enabled for this namespace',
      icon: MTLSIconTypes.LOCK_HOLLOW,
      showStatus: true
    }
  ],
  [MTLSStatuses.DISABLED, emptyDescriptor],
  [MTLSStatuses.NOT_ENABLED, emptyDescriptor]
]);

// Magic style to align Istio Config icons on top of status overview
const iconStyle = kialiStyle({
  marginTop: '-0.125rem',
  marginRight: '0.75rem',
  width: '0.75rem'
});

export const NamespaceMTLSStatus: React.FC<Props> = (props: Props) => {
  return <MTLSStatus status={props.status} className={iconStyle} statusDescriptors={statusDescriptors} />;
};
