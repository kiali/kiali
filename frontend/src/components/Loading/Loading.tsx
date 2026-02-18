import * as React from 'react';
import { InProgressIcon } from '@patternfly/react-icons';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { PFColors } from 'components/Pf/PfColors';
import { classes, keyframes } from 'typestyle';
import { kialiStyle } from 'styles/StyleUtils';

type InProgressSpinnerProps = Omit<SVGIconProps, 'size'> & {
  'aria-label'?: string;
  'aria-labelledBy'?: string;
  'aria-valuetext'?: string;
  className?: string;
  diameter?: string;
  isInline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const sizeMap: Record<NonNullable<InProgressSpinnerProps['size']>, string> = {
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem'
};

const spinAnimation = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' }
});

const inProgressIconStyle = kialiStyle({
  animation: `${spinAnimation} 1.2s linear infinite`,
  color: PFColors.Link,
  display: 'inline-block'
});

const inProgressWrapperStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center'
});

const inProgressInlineStyle = kialiStyle({
  display: 'inline-flex'
});

export const InProgressSpinner: React.FC<InProgressSpinnerProps> = ({
  className,
  size = 'xl',
  'aria-valuetext': ariaValueText = 'Loading...',
  diameter,
  isInline = false,
  'aria-label': ariaLabel,
  'aria-labelledBy': ariaLabelledBy,
  ...props
}) => {
  return (
    <span
      className={classes(inProgressWrapperStyle, isInline && inProgressInlineStyle, className)}
      role="progressbar"
      aria-valuetext={ariaValueText}
      {...(ariaLabel && { 'aria-label': ariaLabel })}
      {...(ariaLabelledBy && { 'aria-labelledby': ariaLabelledBy })}
      {...(!ariaLabel && !ariaLabelledBy && { 'aria-label': 'Contents' })}
    >
      <InProgressIcon className={inProgressIconStyle} style={{ fontSize: diameter ?? sizeMap[size] }} {...props} />
    </span>
  );
};
