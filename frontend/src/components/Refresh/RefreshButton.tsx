import * as React from 'react';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';

type RefreshButtonProps = {
  disabled?: boolean;
  handleRefresh: () => void;
  id?: string;
};

export const RefreshButton: React.FC<RefreshButtonProps> = (props: RefreshButtonProps) => {
  const [enableRefresh, setEnableRefresh] = React.useState<boolean>(true);

  const handleRefresh = (): void => {
    if (enableRefresh) {
      props.handleRefresh();

      // Disable refresh during 500 ms to avoid multiple refresh in very short period of time
      setEnableRefresh(false);
      setTimeout(() => setEnableRefresh(true), 500);
    }
  };

  return (
    <Tooltip position="bottom" content={<>Refresh</>}>
      <Button icon={<SyncAltIcon />}
        id={props.id ?? 'refresh_button'}
        data-test="refresh-button"
        onClick={handleRefresh}
        isDisabled={props.disabled ?? false}
        aria-label="Action"
        variant={ButtonVariant.primary}
      >
        
      </Button>
    </Tooltip>
  );
};
