import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';

const optionDisabledStyle = kialiStyle({
  cursor: 'not-allowed',
  $nest: {
    '& button': {
      pointerEvents: 'none'
    }
  }
});

export const renderDisabledDropdownOption = (
  key: string,
  position: TooltipPosition,
  message: string,
  child: React.ReactElement
): JSX.Element => {
  return (
    <Tooltip key={'tooltip_' + key} position={position} content={<>{message}</>}>
      <div className={optionDisabledStyle}>{child}</div>
    </Tooltip>
  );
};
