import * as React from 'react';
import { Button, Spinner } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';
import { t } from 'utils/I18nUtils';

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

const helperTextStyle = kialiStyle({
  color: PFColors.Color200,
  fontSize: '0.875rem'
});

const errorIconStyle = kialiStyle({
  fontSize: '3rem'
});

const tryAgainStyle = kialiStyle({
  textDecoration: 'none',
  $nest: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'none'
    }
  }
});

type OverviewCardStateBaseProps = {
  className?: string;
};

export type OverviewCardLoadingStateProps = OverviewCardStateBaseProps & {
  message: string;
};

export const OverviewCardLoadingState: React.FC<OverviewCardLoadingStateProps> = props => {
  return (
    <div className={classes(baseContainerStyle, centerStyle, props.className)}>
      <Spinner size="lg" aria-label={props.message} />
      <div className={helperTextStyle}>{props.message}</div>
    </div>
  );
};

export type OverviewCardErrorStateProps = OverviewCardStateBaseProps & {
  icon?: React.ReactNode;
  message: string;
  onTryAgain?: () => void;
};

export const OverviewCardErrorState: React.FC<OverviewCardErrorStateProps> = props => {
  return (
    <div className={classes(baseContainerStyle, centerStyle, props.className)}>
      {props.icon ?? <KialiIcon.Unknown className={errorIconStyle} size="xl" color={PFColors.Color200} />}
      <div className={helperTextStyle}>{props.message}</div>
      {props.onTryAgain && (
        <Button className={tryAgainStyle} variant="link" isInline onClick={props.onTryAgain}>
          {t('Try Again')}
        </Button>
      )}
    </div>
  );
};
