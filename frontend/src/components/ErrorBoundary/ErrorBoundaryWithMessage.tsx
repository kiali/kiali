import * as React from 'react';
import { Alert, Card, CardBody } from '@patternfly/react-core';
import { ErrorBoundary } from './ErrorBoundary';

interface MessageProps {
  children: React.ReactNode;
  message: string;
}

export const ErrorBoundaryWithMessage: React.FC<MessageProps> = (props: MessageProps) => {
  const alert = (): React.ReactNode => {
    return (
      <Card>
        <CardBody>
          <Alert variant="warning" title={props.message ?? 'Something went wrong rendering this component'}>
            {' '}
          </Alert>
        </CardBody>
      </Card>
    );
  };

  return <ErrorBoundary fallBackComponent={alert()}>{props.children}</ErrorBoundary>;
};
