import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

interface SecondaryMastheadProps {
  children: React.ReactNode;
}

const secondaryMastheadStyle = kialiStyle({
  position: 'sticky',
  zIndex: 10
});

export const SecondaryMasthead: React.FC<SecondaryMastheadProps> = (props: SecondaryMastheadProps) => {
  return (
    <div id="global-namespace-selector" className={secondaryMastheadStyle}>
      {props.children}
    </div>
  );
};
