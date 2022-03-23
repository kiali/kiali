import * as React from 'react';
import { Status } from 'types/Health';

type Size = 'sm' | 'md' | 'lg' | 'xl';

export const createIcon = (status: Status, size?: Size) => {
  return React.createElement(status.icon, { color: status.color, size: size, className: status.class });
};
