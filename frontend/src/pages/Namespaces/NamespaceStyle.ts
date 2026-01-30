import { CSSProperties } from 'react';
import { kialiStyle } from 'styles/StyleUtils';

export const headerWithHelpStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: '0.5rem'
});

export const namespaceNaIconStyle: CSSProperties = {
  color: 'var(--pf-t--global--icon--color--disabled)'
};
