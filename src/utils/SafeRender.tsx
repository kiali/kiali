import * as React from 'react';
import { Icon } from 'patternfly-react';

export const canRender = (value: any): boolean => {
  return typeof value !== 'object';
};

export const renderErrorMessage = (message: string): any => {
  return (
    <Icon type="pf" name="error">
      {' '}
      {message + ' '}
    </Icon>
  );
};

export const safeRender = (value: any, message = 'Invalid value'): any => {
  return canRender(value) ? value : renderErrorMessage(message);
};
