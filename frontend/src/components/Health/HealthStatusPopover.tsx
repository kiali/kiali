import * as React from 'react';
import { Popover, PopoverPosition } from '@patternfly/react-core';
import { createIcon } from '../../config/KialiIcon';
import * as H from '../../types/Health';
import { NA, HEALTHY } from '../../types/Health';
import { HealthDetails } from './HealthDetails';
import { t } from 'utils/I18nUtils';

type HealthStatusPopoverProps = {
  health?: H.Health;
};

export const HealthStatusPopover: React.FC<HealthStatusPopoverProps> = ({ health }) => {
  const status = health ? health.getStatus() : NA;
  const isUnhealthy = health && status !== HEALTHY && status !== NA;

  const statusContent = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        cursor: isUnhealthy ? 'pointer' : undefined
      }}
    >
      {createIcon(status)}
      {status.name}
    </span>
  );

  if (isUnhealthy) {
    return (
      <Popover
        aria-label={t('Health details')}
        position={PopoverPosition.right}
        triggerAction="click"
        showClose={true}
        headerContent={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {createIcon(status)} <strong>{status.name}</strong>
          </span>
        }
        bodyContent={<HealthDetails health={health!} />}
      >
        {statusContent}
      </Popover>
    );
  }

  return statusContent;
};
