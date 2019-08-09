import * as React from 'react';
import { Status } from 'types/Health';
import { Validation } from '../ConfigValidation/ConfigIndicator';

type Size = 'sm' | 'md' | 'lg' | 'xl';

export const createIcon = (status: Status | Validation, size?: Size) => {
  return React.createElement(status.icon, { color: status.color, size: size, className: status.class });
};
