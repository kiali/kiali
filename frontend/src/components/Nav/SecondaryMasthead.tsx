import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

interface SecondaryMastheadProps {
  children: React.ReactNode;
}

const marginStyle = kialiStyle({
  margin: '0.625rem 1.25rem 0 0'
});

const secondaryMastheadStyle = kialiStyle({
  position: 'sticky',
  zIndex: 10,
  marginLeft: 0,
  marginRight: 0,
  paddingRight: '1.25rem',
  paddingLeft: '1.25rem'
});

export const SecondaryMasthead: React.FC<SecondaryMastheadProps> = (props: SecondaryMastheadProps) => {
  return (
    <div id="global-namespace-selector" className={secondaryMastheadStyle}>
      <div className={marginStyle}>{props.children}</div>
    </div>
  );
};
