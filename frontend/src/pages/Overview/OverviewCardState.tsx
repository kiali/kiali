import * as React from 'react';
import { Spinner } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';

const baseContainerStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  flex: 1,
  gap: '0.5rem',
  minHeight: '3.5rem'
});

const centerStyle = kialiStyle({
  justifyContent: 'center'
});

const bottomStyle = kialiStyle({
  justifyContent: 'flex-end'
});

const helperTextStyle = kialiStyle({
  color: PFColors.Color200,
  fontSize: '0.875rem'
});

const errorIconStyle = kialiStyle({
  // PatternFly <Icon> scales using font-size.
  fontSize: '3rem',
  color: PFColors.Color200,
  $nest: {
    '& svg': {
      color: PFColors.Color200,
      fill: PFColors.Color200
    }
  }
});

type OverviewCardStateBaseProps = {
  align?: 'center' | 'bottom';
  className?: string;
};

export type OverviewCardLoadingStateProps = OverviewCardStateBaseProps & {
  message: string;
};

export const OverviewCardLoadingState: React.FC<OverviewCardLoadingStateProps> = props => {
  const alignClass = props.align === 'bottom' ? bottomStyle : centerStyle;
  return (
    <div className={classes(baseContainerStyle, alignClass, props.className)}>
      <Spinner size="lg" aria-label={props.message} />
      <div className={helperTextStyle}>{props.message}</div>
    </div>
  );
};

export type OverviewCardErrorStateProps = OverviewCardStateBaseProps & {
  icon?: React.ReactNode;
  message: string;
};

export const OverviewCardErrorState: React.FC<OverviewCardErrorStateProps> = props => {
  const alignClass = props.align === 'bottom' ? bottomStyle : centerStyle;
  return (
    <div className={classes(baseContainerStyle, alignClass, props.className)}>
      {props.icon ?? <KialiIcon.Unknown className={errorIconStyle} size="xl" color={PFColors.Color200} />}
      <div className={helperTextStyle}>{props.message}</div>
    </div>
  );
};
