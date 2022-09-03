import * as React from 'react';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';

type ComponentProps = {
  id?: string;
  disabled?: boolean;
  handleRefresh: () => void;
};

class RefreshButton extends React.Component<ComponentProps> {
  getElementId() {
    return this.props.id || 'refresh_button';
  }

  getDisabled() {
    return this.props.disabled || false;
  }

  render() {
    return (
      <Tooltip position="bottom" content={<>Refresh</>}>
        <Button
          id={this.getElementId()}
          data-test="refresh-button"
          onClick={this.handleRefresh}
          isDisabled={this.getDisabled()}
          aria-label="Action"
          variant={ButtonVariant.primary}
        >
          <SyncAltIcon />
        </Button>
      </Tooltip>
    );
  }

  private handleRefresh = () => {
    this.props.handleRefresh();
  };
}

export default RefreshButton;
