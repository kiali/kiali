import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { EmptyState, EmptyStateBody, EmptyStateVariant, EmptyStateHeader } from '@patternfly/react-core';
import { ErrorMsg } from '../../types/ErrorMsg';

interface MessageProps {
  error: ErrorMsg;
}

const errorSectionStyle = kialiStyle({
  height: '80vh'
});

export class ErrorSection extends React.Component<MessageProps> {
  render() {
    return (
      <div>
        <EmptyState id="empty-page-error" variant={EmptyStateVariant.lg} className={errorSectionStyle}>
          <EmptyStateHeader titleText={<>{this.props.error.title}</>} headingLevel="h5" />
          <EmptyStateBody>{this.props.error.description}</EmptyStateBody>
        </EmptyState>
      </div>
    );
  }
}
