import * as React from 'react';

import { MTLSIcon } from './MTLSIcon';
import { TooltipPosition } from '@patternfly/react-core';

type MTLSStatusProps = {
  className?: string;
  overlayPosition?: TooltipPosition;
  status: string;
  statusDescriptors: Map<string, StatusDescriptor>;
};

export type StatusDescriptor = {
  icon: string;
  message: string;
  showStatus: boolean;
};

export const emptyDescriptor = {
  icon: '',
  message: '',
  showStatus: false
};

export const MTLSStatus: React.FC<MTLSStatusProps> = (props: MTLSStatusProps) => {
  const statusDescriptor = props.statusDescriptors.get(props.status) ?? emptyDescriptor;

  if (statusDescriptor.showStatus) {
    return (
      <MTLSIcon
        icon={statusDescriptor.icon}
        iconClassName={props.className ?? ''}
        tooltipText={statusDescriptor.message}
        tooltipPosition={props.overlayPosition ?? TooltipPosition.bottom}
      />
    );
  }

  return null;
};
