import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import fullIcon from '../../assets/img/mtls-status-full.svg';
import hollowIcon from '../../assets/img/mtls-status-partial.svg';
import fullIconDark from '../../assets/img/mtls-status-full-dark.svg';
import hollowIconDark from '../../assets/img/mtls-status-partial-dark.svg';
import { useKialiTheme } from 'utils/ThemeUtils';
import { Theme } from 'types/Common';

type MTLSIconProps = {
  icon: string;
  iconClassName: string;
  tooltipPosition: TooltipPosition;
  tooltipText: string;
};

export enum MTLSIconTypes {
  LOCK_FULL = 'LOCK_FULL',
  LOCK_HOLLOW = 'LOCK_HOLLOW'
}

export const MTLSIcon: React.FC<MTLSIconProps> = (props: MTLSIconProps) => {
  const darkTheme = useKialiTheme() === Theme.DARK;
  const [mtlsIcon, setMtlsIcon] = React.useState('');

  React.useEffect(() => {
    if (props.icon === MTLSIconTypes.LOCK_FULL) {
      setMtlsIcon(darkTheme ? fullIcon : fullIconDark);
    } else if (props.icon === MTLSIconTypes.LOCK_HOLLOW) {
      setMtlsIcon(darkTheme ? hollowIcon : hollowIconDark);
    }
  }, [darkTheme, props.icon]);

  return (
    <Tooltip aria-label="mTLS status" position={props.tooltipPosition} enableFlip={true} content={props.tooltipText}>
      <img key={mtlsIcon} className={props.iconClassName} src={mtlsIcon} alt={props.tooltipPosition} />
    </Tooltip>
  );
};
