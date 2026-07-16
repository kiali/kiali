import * as React from 'react';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { triggerRefresh } from '../../hooks/refresh';

type Props = {
  canUpdate: boolean;
  objectName: string;
  onCancel: () => void;
  onOverview: () => void;
  // Return false when refresh is deferred (e.g. unsaved-changes confirmation).
  onRefresh: () => boolean;
  onUpdate: () => void;
  overview: boolean;
  readOnly: boolean;
  showOverview: boolean;
};

export const IstioActionButtons: React.FC<Props> = (props: Props) => {
  const handleRefresh = (): void => {
    if (props.onRefresh()) {
      triggerRefresh();
    }
  };

  return (
    <>
      <span style={{ float: 'left', padding: '0.5rem' }}>
        {!props.readOnly && (
          <span style={{ paddingRight: '0.25rem' }}>
            <Button variant={ButtonVariant.primary} isDisabled={!props.canUpdate} onClick={props.onUpdate}>
              Save
            </Button>
          </span>
        )}

        <span style={{ paddingRight: '0.25rem' }}>
          <Button variant={ButtonVariant.secondary} onClick={handleRefresh} data-test="reload-istio-config">
            Reload
          </Button>
        </span>

        <span style={{ paddingRight: '0.25rem' }}>
          <Button variant={ButtonVariant.secondary} onClick={props.onCancel} data-test="cancel-istio-config">
            {props.readOnly ? 'Close' : 'Cancel'}
          </Button>
        </span>
      </span>

      {props.showOverview && (
        <span style={{ float: 'right', padding: '0.5rem' }}>
          <span style={{ paddingLeft: '0.25rem' }}>
            <Button variant={ButtonVariant.link} onClick={props.onOverview}>
              {props.overview ? 'Close Overview' : 'Show Overview'}
            </Button>
          </span>
        </span>
      )}
    </>
  );
};
