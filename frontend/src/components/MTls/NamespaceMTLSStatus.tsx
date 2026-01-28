import * as React from 'react';
import { MTLSStatus } from './MTLSStatus';
import { kialiStyle } from 'styles/StyleUtils';
import { namespaceMTLSStatusDescriptors } from './NamespaceMTLSStatusDescriptors';

type Props = {
  status: string;
};

// Magic style to align Istio Config icons on top of status overview
const iconStyle = kialiStyle({
  marginTop: '-0.125rem',
  marginRight: '0.75rem',
  width: '1em',
  height: '1em'
});

export const NamespaceMTLSStatus: React.FC<Props> = (props: Props) => {
  return <MTLSStatus status={props.status} className={iconStyle} statusDescriptors={namespaceMTLSStatusDescriptors} />;
};
