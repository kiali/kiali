import * as React from 'react';
import { ErrorCircleOIcon } from '@patternfly/react-icons';

export const canRender = (value: any): boolean => {
  return typeof value !== 'object';
};

export const renderErrorMessage = (message: string): any => {
  return (
    <>
      <ErrorCircleOIcon /> {message + ' '}
    </>
  );
};

export const safeRender = (value: any, message = 'Invalid value'): any => {
  return canRender(value) ? value : renderErrorMessage(message);
};
