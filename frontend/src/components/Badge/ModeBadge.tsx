import * as React from 'react';
import { Label, Popover, PopoverPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { infoStyle } from 'styles/IconStyle';
import { t } from 'utils/I18nUtils';
import { clickableInlineStyle, inlineIconRowStyle } from 'styles/FlexStyles';

type ModeBadgeProps = {
  isAmbient?: boolean;
  istioSidecar?: boolean;
  mode?: 'ambient' | 'sidecar' | 'none';
  popoverMessage?: React.ReactNode;
};

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, isAmbient, istioSidecar, popoverMessage }) => {
  const resolved = mode ?? (isAmbient ? 'ambient' : istioSidecar ? 'sidecar' : 'none');

  let label: React.ReactNode;

  switch (resolved) {
    case 'ambient':
      label = (
        <Label variant="outline" color="blue" isCompact>
          {t('Ambient')}
        </Label>
      );
      break;
    case 'sidecar':
      label = (
        <Label variant="outline" color="orange" isCompact>
          {t('Sidecar')}
        </Label>
      );
      break;
    default:
      label = (
        <Label variant="outline" color="grey" isCompact>
          {t('Not applicable')}
        </Label>
      );
  }

  if (!popoverMessage) {
    return <>{label}</>;
  }

  return (
    <span className={inlineIconRowStyle}>
      {label}
      <Popover aria-label={t('Mode info')} position={PopoverPosition.right} bodyContent={popoverMessage}>
        <span className={clickableInlineStyle}>
          <KialiIcon.Info className={infoStyle} />
        </span>
      </Popover>
    </span>
  );
};
